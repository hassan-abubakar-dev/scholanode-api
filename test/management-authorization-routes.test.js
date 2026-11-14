import assert from "node:assert/strict";
import { mock, test } from "node:test";

const Owner = {
  findOne: async () => ({ id: "owner-1" }),
};

mock.module("../relationships/associations.js", {
  namedExports: { Owner, User: {} },
});
mock.module("../controllers/staff.js", {
  namedExports: Object.fromEntries([
    "getAllStaff",
    "deactivateStaff",
    "activateStaff",
    "getLeaderStatus",
    "updateStaff",
    "resetStaffPassword",
    "inviteStaff",
    "importStaffCsv",
  ].map((name) => [name, () => {}])),
});
mock.module("../controllers/payment.js", {
  namedExports: Object.fromEntries([
    "initializePayment",
    "initializeUpgradePayment",
    "getPaymentStatus",
    "getPaymentHistory",
    "getPaymentReceipt",
  ].map((name) => [name, () => {}])),
});
mock.module("../controllers/school.js", {
  namedExports: Object.fromEntries([
    "checkSchoolCode",
    "registerSchool",
    "getSchoolSetupProgress",
    "getSchoolByCode",
    "getMySchool",
    "updateSchoolSetup",
    "requestSchoolLogoUpload",
    "confirmSchoolLogoUpload",
    "createAcademicSetup",
    "createClassSetup",
    "createSubjectSetup",
  ].map((name) => [name, () => {}])),
});
mock.module("../controllers/academicSetup.js", {
  namedExports: Object.fromEntries([
    "createSessionWithTerms",
    "createClass",
    "createSubject",
    "saveWorkingDays",
    "createAssessmentConfiguration",
    "getAcademicSetupProgress",
  ].map((name) => [name, () => {}])),
});
mock.module("../controllers/sessionTerm.js", {
  namedExports: Object.fromEntries([
    "getAllSessionsAndTerms",
    "updateSessionWithTerms",
    "activateSession",
    "completeSession",
    "activateTerm",
    "completeTerm",
  ].map((name) => [name, () => {}])),
});
mock.module("../controllers/subscription.js", {
  namedExports: { getSubscriptionOverview: () => {} },
});

const {
  authorizeAcademicManagement,
  authorizeAcademicRead,
  authorizeSchoolManagement,
  protectRoutes,
} = await import("../middleware/auth.js");
const { default: staffRouter } = await import("../routes/staff.js");
const { default: paymentRouter } = await import("../routes/payment.js");
const { default: schoolRouter } = await import("../routes/school.js");
const { default: academicSetupRouter } = await import("../routes/academicSetup.js");
const { default: sessionTermRouter } = await import("../routes/sessionTerm.js");
const { default: subscriptionRouter } = await import("../routes/subscription.js");

const routes = (router) =>
  router.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route);

const invoke = async (middleware, req) => {
  let nextError;
  await middleware(req, {}, (error) => {
    nextError = error;
  });
  return nextError;
};

test("staff management routes use owner-aware authorization except activation routes", () => {
  const activationPaths = [
    "/:staffId/deactivate",
    "/:staffId/activate",
  ];

  for (const route of routes(staffRouter)) {
    if (activationPaths.includes(route.path)) {
      assert.equal(route.stack[0].handle, protectRoutes);
      assert.notEqual(route.stack[1].handle, authorizeSchoolManagement);
      continue;
    }

    assert.equal(route.stack[0].handle, protectRoutes);
    assert.equal(route.stack[1].handle, authorizeSchoolManagement);
  }
});

test("staff activation routes remain restricted to school management roles", async () => {
  for (const route of routes(staffRouter).filter((entry) =>
    entry.path.endsWith("/activate") || entry.path.endsWith("/deactivate")
  )) {
    const guard = route.stack[1].handle;
    for (const role of ["LEADER", "VICE_LEADER", "ADMINISTRATOR"]) {
      assert.equal(await invoke(guard, {
        user: { id: "user-1", schoolId: "school-1", role },
      }), undefined);
    }
    assert.equal((await invoke(guard, {
      user: { id: "owner-1", schoolId: "school-1", role: "OWNER" },
    })).statusCode, 403);
  }
});

test("subscription upgrade route delegates access to owner-aware management middleware", async () => {
  const route = routes(paymentRouter).find(
    (entry) => entry.path === "/schools/:schoolId/upgrade/initialize"
  );

  assert.equal(route.stack[0].handle, protectRoutes);
  assert.equal(route.stack[1].handle, authorizeSchoolManagement);

  const ownerError = await invoke(authorizeSchoolManagement, {
    user: { id: "owner-1", schoolId: "school-1", role: "OWNER" },
  });
  assert.equal(ownerError, undefined);
});

test("school profile and setup routes use owner-aware management authorization", () => {
  const protectedPaths = [
    "/setup-progress",
    "/my-school",
    "/my-school/setup",
    "/my-school/logo/upload-url",
    "/my-school/logo",
    "/my-school/academic-setup",
    "/my-school/class-setup",
    "/my-school/subject-setup",
  ];

  for (const path of protectedPaths) {
    const route = routes(schoolRouter).find((entry) => entry.path === path);
    assert.ok(route, `Missing school route ${path}`);
    assert.equal(route.stack[0].handle, protectRoutes);
    assert.equal(route.stack[1].handle, authorizeSchoolManagement);
  }

  for (const path of ["/register", "/check-code", "/get/:code"]) {
    const route = routes(schoolRouter).find((entry) => entry.path === path);
    assert.ok(route, `Missing public school route ${path}`);
    assert.notEqual(route.stack[0].handle, authorizeSchoolManagement);
  }
});

test("academic setup and session routes use the matching management middleware", () => {
  const generalSetup = routes(academicSetupRouter).filter((route) =>
    ["/session", "/class", "/subject", "/working-days"].includes(route.path)
  );
  assert.equal(generalSetup.length, 4);
  for (const route of generalSetup) {
    assert.equal(route.stack[0].handle, protectRoutes);
    assert.equal(route.stack[1].handle, authorizeSchoolManagement);
  }

  const assessmentSetup = routes(academicSetupRouter).find(
    (route) => route.path === "/assessment-configuration"
  );
  assert.equal(assessmentSetup.stack[1].handle, authorizeAcademicManagement);

  const sessionRoutes = routes(sessionTermRouter);
  for (const route of sessionRoutes.filter((entry) => !entry.methods.get)) {
    assert.equal(route.stack[1].handle, authorizeSchoolManagement);
  }
  const sessionRead = sessionRoutes.find((entry) => entry.methods.get);
  assert.equal(sessionRead.stack[1].handle, authorizeAcademicRead);
});

test("payment status and subscription overview use owner-aware management middleware", () => {
  const paymentStatus = routes(paymentRouter).find(
    (route) => route.path === "/:reference/status"
  );
  assert.equal(paymentStatus.stack[0].handle, protectRoutes);
  assert.equal(paymentStatus.stack[1].handle, authorizeSchoolManagement);

  const overview = routes(subscriptionRouter).find(
    (route) => route.path === "/overview"
  );
  assert.equal(overview.stack[0].handle, protectRoutes);
  assert.equal(overview.stack[1].handle, authorizeSchoolManagement);
});
