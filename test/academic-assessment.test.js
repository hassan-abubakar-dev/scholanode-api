// Run: node --experimental-test-module-mocks --test test/academic-assessment.test.js
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import {
  createAssessmentConfigurationSchema,
  createClassSchema,
} from "../validation/academicSetup.js";
import { updateAssessmentConfigurationSchema } from "../validation/assessmentConfiguration.js";

// Module mocks are scoped to this isolated test process. Never load DB config,
// associations or controllers, so no .env access or live DB operations occur.
const Owner = {
  findOne: async () => {
    throw new Error("Unexpected ownership lookup");
  },
};
mock.module("../relationships/associations.js", {
  namedExports: { Owner, User: {} },
});
mock.module("../config/db.js", {
  namedExports: {
    dbConnection: {
      define: (_name, rawAttributes) => ({ rawAttributes }),
    },
  },
});
for (const [modulePath, names] of [
  ["../controllers/academicSetup.js", [
    "createSessionWithTerms", "createClass", "createSubject", "saveWorkingDays",
    "createAssessmentConfiguration", "getAcademicSetupProgress",
  ]],
  ["../controllers/sessionTerm.js", [
    "getAllSessionsAndTerms", "updateSessionWithTerms", "activateSession",
    "completeSession", "activateTerm", "completeTerm",
  ]],
  ["../controllers/assessmentConfiguration.js", [
    "getAssessmentSections", "getAssessmentConfigurations",
    "updateAssessmentConfiguration", "getAssessmentConfigurationHistory",
  ]],
]) {
  mock.module(modulePath, {
    namedExports: Object.fromEntries(names.map((name) => [name, () => {
      throw new Error("Controllers must not run in authorization tests");
    }])),
  });
}

const {
  authorizeAcademicRead,
  authorizeSchoolManagement,
  protectRoutes,
} = await import("../middleware/auth.js");
const { default: academicSetup } = await import("../routes/academicSetup.js");
const { default: sessionTerm } = await import("../routes/sessionTerm.js");
const { default: assessment } = await import("../routes/assessmentConfiguration.js");
const models = await Promise.all([
  import("../models/AssessmentConfiguration.js"),
  import("../models/Class.js"),
  import("../models/TermAssessmentConfiguration.js"),
]);

const user = (role) => ({ id: "user-1", schoolId: "school-1", role });
const roles = ["LEADER", "VICE_LEADER", "EXAM_OFFICER", "ADMINISTRATOR", "TEACHER", "STUDENT", "OWNER"];
const routes = (router) => router.stack.filter((layer) => layer.route).map((layer) => layer.route);

async function authorizeWith(middleware, request) {
  const next = mock.fn();
  await middleware(request, {}, next);
  assert.equal(next.mock.callCount(), 1);
  return next.mock.calls[0].arguments[0];
}

for (const role of ["LEADER", "VICE_LEADER", "EXAM_OFFICER"]) {
  test(`academic read permits ${role} without an ownership lookup`, async () => {
    assert.equal(await authorizeWith(authorizeAcademicRead, { user: user(role) }), undefined);
  });
}

test("academic read rejects missing authentication or school context", async () => {
  const requests = [{}, { user: null }];
  for (const role of roles) {
    requests.push({ user: { role } }, { user: { role, id: "user-1" } }, { user: { role, schoolId: "school-1" } });
  }
  for (const request of requests) {
    assert.equal((await authorizeWith(authorizeAcademicRead, request)).statusCode, 403);
  }
});

test("academic read allows only ownership verified for the authenticated user and school", async (t) => {
  const lookup = t.mock.method(Owner, "findOne", async ({ where }) => (
    where.userId === "user-1" && where.schoolId === "school-1" ? { id: "owner-1" } : null
  ));
  for (const role of ["TEACHER", "OWNER", "ADMINISTRATOR"]) {
    assert.equal(await authorizeWith(authorizeAcademicRead, { user: user(role) }), undefined);
    assert.deepEqual(lookup.mock.calls.at(-1).arguments[0], {
      where: { userId: "user-1", schoolId: "school-1" },
      attributes: ["id"],
    });
  }
  for (const identity of [
    { ...user("OWNER"), id: "other-user" },
    { ...user("OWNER"), schoolId: "other-school" },
  ]) {
    assert.equal((await authorizeWith(authorizeAcademicRead, { user: identity })).statusCode, 403);
  }
});

test("school management excludes EXAM_OFFICER unless verified as an owner", async (t) => {
  const lookup = t.mock.method(Owner, "findOne", async () => null);

  for (const role of ["LEADER", "VICE_LEADER", "ADMINISTRATOR"]) {
    assert.equal(
      await authorizeWith(authorizeSchoolManagement, { user: user(role) }),
      undefined
    );
  }

  assert.equal(
    (await authorizeWith(authorizeSchoolManagement, {
      user: user("EXAM_OFFICER"),
    })).statusCode,
    403
  );
  assert.equal(lookup.mock.callCount(), 1);
});

test("academic read denies ADMINISTRATOR and unverified OWNER claims", async (t) => {
  t.mock.method(Owner, "findOne", async () => null);
  for (const role of ["ADMINISTRATOR", "TEACHER", "STUDENT", "OWNER", undefined]) {
    assert.equal((await authorizeWith(authorizeAcademicRead, { user: user(role) })).statusCode, 403);
  }
});

test("academic read forwards ownership lookup failures", async (t) => {
  const error = new Error("Ownership lookup failed");
  t.mock.method(Owner, "findOne", async () => { throw error; });
  assert.equal(await authorizeWith(authorizeAcademicRead, { user: user("TEACHER") }), error);
});

test("only the intended GET routes use academic read, after authentication", async () => {
  for (const [router, path] of [[academicSetup, "/progress"], [sessionTerm, "/"]]) {
    const readRoutes = routes(router).filter((route) => route.stack.some((layer) => layer.handle === authorizeAcademicRead));
    assert.equal(readRoutes.length, 1);
    assert.equal(readRoutes[0].path, path);
    assert.deepEqual(Object.keys(readRoutes[0].methods), ["get"]);
    assert.equal(readRoutes[0].stack[0].handle, protectRoutes);
    assert.equal(readRoutes[0].stack[1].handle, authorizeAcademicRead);
    assert.equal((await authorizeWith(protectRoutes, { headers: {} })).statusCode, 401);
  }
});

test("session, class, subject and working-days write permissions stay unchanged", async () => {
  const writeRoutes = [...routes(academicSetup), ...routes(sessionTerm)]
    .filter((route) => !route.methods.get && route.path !== "/assessment-configuration");
  assert.equal(writeRoutes.length, 9);
  for (const route of writeRoutes) {
    assert.equal(route.stack[0].handle, protectRoutes);
    for (const role of roles) {
      const error = await authorizeWith(route.stack[1].handle, { user: user(role) });
      if (["LEADER", "VICE_LEADER", "ADMINISTRATOR"].includes(role)) {
        assert.equal(error, undefined);
      } else {
        assert.equal(error.statusCode, 403);
      }
    }
  }
});

test("assessment CREATE and UPDATE remain restricted even for verified owners", async (t) => {
  const lookup = t.mock.method(Owner, "findOne", async () => ({ id: "owner-1" }));
  const create = routes(academicSetup).find((route) => route.path === "/assessment-configuration");
  const update = routes(assessment).find((route) => route.methods.put);
  assert.equal(create.stack[0].handle, protectRoutes);
  assert.equal(assessment.stack[0].handle, protectRoutes);
  for (const guard of [create.stack[1].handle, update.stack[0].handle]) {
    for (const role of roles) {
      const error = await authorizeWith(guard, { user: user(role) });
      if (["LEADER", "VICE_LEADER", "EXAM_OFFICER"].includes(role)) {
        assert.equal(error, undefined);
      } else {
        assert.equal(error.statusCode, 403);
      }
    }
  }
  assert.equal(lookup.mock.callCount(), 0);
});

const payload = (maximumMark = 100, educationSection = "EARLY_YEARS") => ({
  educationSection,
  effectiveFromTermId: "123e4567-e89b-42d3-a456-426614174000",
  components: [{ componentName: "Exam", maximumMark, weightPercentage: 100 }],
});

test("assessment, class and term assignment enums agree with validation", () => {
  const sections = ["EARLY_YEARS", "PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"];
  for (const { default: model } of models) {
    assert.deepEqual(model.rawAttributes.educationSection.type.values, sections);
  }
  for (const section of sections) {
    assert.equal(createAssessmentConfigurationSchema.validate(payload(100, section)).error, undefined);
    assert.equal(createClassSchema.validate({ classLevel: "Level 1", educationSection: section }).error, undefined);
  }
  assert.ok(createAssessmentConfigurationSchema.validate(payload(100, "NURSERY")).error);
  assert.ok(createClassSchema.validate({ classLevel: "Level 1", educationSection: "NURSERY" }).error);
});

test("initial and update mark validation share the DECIMAL(8,2) upper limit", () => {
  for (const schema of [createAssessmentConfigurationSchema, updateAssessmentConfigurationSchema]) {
    const validateMark = (mark) => {
      const data = payload(mark);
      return schema.validate(schema === createAssessmentConfigurationSchema ? data : { components: data.components }, { convert: false });
    };
    for (const mark of [0.01, 100, 999999.99]) {
      assert.equal(validateMark(mark).error, undefined);
    }
    const overflow = validateMark(1000000).error;
    assert.equal(overflow.details[0].type, "number.max");
    assert.equal(overflow.details[0].message, "Maximum mark cannot exceed 999999.99.");
    for (const mark of [0, -1, 1.234]) {
      assert.ok(validateMark(mark).error);
    }
  }
});
