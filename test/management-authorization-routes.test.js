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

const {
  authorizeSchoolManagement,
  protectRoutes,
} = await import("../middleware/auth.js");
const { default: staffRouter } = await import("../routes/staff.js");
const { default: paymentRouter } = await import("../routes/payment.js");

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
