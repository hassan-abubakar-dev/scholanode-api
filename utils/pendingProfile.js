// Staff invitations are created with these placeholder names until the invited
// person signs in and completes their profile with their real name.
export const PENDING_PROFILE_NAMES = {
  firstName: "firstName",
  surName: "surName",
};

export const hasPendingProfile = (user) =>
  user?.firstName === PENDING_PROFILE_NAMES.firstName &&
  user?.surName === PENDING_PROFILE_NAMES.surName;

/**
 * Serializes a staff record that is embedded inside another resource
 * (a class form master, a scanner grant, and so on).
 *
 * Nested embeds used to ship the invitation placeholders as if they were real
 * names, so any view that joined firstName + surName rendered
 * "firstName surName". The placeholders are replaced with nulls and
 * profilePending tells the view to show the pending state instead.
 */
export const serializeStaffProfile = (staff) => {
  if (!staff) return staff;

  const source =
    typeof staff.toJSON === "function" ? staff.toJSON() : { ...staff };

  const profilePending = hasPendingProfile(source);

  return {
    ...source,
    firstName: profilePending ? null : source.firstName,
    surName: profilePending ? null : source.surName,
    profilePending,
  };
};
