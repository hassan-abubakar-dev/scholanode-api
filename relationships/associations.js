import School from "../models/School.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import User from "../models/User.js";
import Owner from "../models/Owner.js";
import Student from "../models/Student.js";
import Class from "../models/Class.js";
import Subject from "../models/Subject.js";
import Session from "../models/Session.js";
import Term from "../models/Term.js";
import SubjectAssignment from "../models/SubjectAssignment.js";
import Parent from "../models/Parent.js";
import ParentStudent from "../models/ParentStudent.js";

/*
|--------------------------------------------------------------------------
| School Relationships
|--------------------------------------------------------------------------
*/

// School has one Subscription Plan
School.hasOne(SubscriptionPlan, {
  foreignKey: "schoolId",
  as: "subscriptionPlan",
});

SubscriptionPlan.belongsTo(School, {
  foreignKey: "schoolId",
  as: "school",
});

// School has many Users
School.hasMany(User, {
  foreignKey: "schoolId",
  as: "users",
});

User.belongsTo(School, {
  foreignKey: "schoolId",
  as: "school",
});

// School has many Students
School.hasMany(Student, {
  foreignKey: "schoolId",
  as: "students",
});

Student.belongsTo(School, {
  foreignKey: "schoolId",
  as: "school",
});

// owner and user relationship
Owner.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// School has many Classes
School.hasMany(Class, { 
  foreignKey: "schoolId",
  as: "classes",
});

Class.belongsTo(School, {
  foreignKey: "schoolId",
  as: "school",
});

// School has many Subjects
School.hasMany(Subject, {
  foreignKey: "schoolId",
  as: "subjects",
});

Subject.belongsTo(School, {
  foreignKey: "schoolId",
  as: "school",
});

// School has many Sessions
School.hasMany(Session, {
  foreignKey: "schoolId",
  as: "sessions",
});

Session.belongsTo(School, {
  foreignKey: "schoolId",
  as: "school",
});

/*
|--------------------------------------------------------------------------
| Student Relationships
|--------------------------------------------------------------------------
*/

// Every User with STUDENT role has one Student record
User.hasOne(Student, {
  foreignKey: "userId",
  as: "student",
});

Student.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});



/*
|--------------------------------------------------------------------------
| School Class Relationships
|--------------------------------------------------------------------------
*/

// A Class has many Students
Class.hasMany(Student, {
  foreignKey: "currentClassId",
  as: "students",
});

Student.belongsTo(Class, {
  foreignKey: "currentClassId",
  as: "currentClass",
});

// A Teacher (User) can be Form Master of many Classes
User.hasMany(Class, {
  foreignKey: "formMasterId",
  as: "formMasterClasses",
});

Class.belongsTo(User, {
  foreignKey: "formMasterId",
  as: "formMaster",
});

/*
|--------------------------------------------------------------------------
| Session & Term Relationships
|--------------------------------------------------------------------------
*/

// A Session has many Terms
Session.hasMany(Term, {
  foreignKey: "sessionId",
  as: "terms",
});

Term.belongsTo(Session, {
  foreignKey: "sessionId",
  as: "session",
});

/*
|--------------------------------------------------------------------------
| Subject Assignment Relationships
|--------------------------------------------------------------------------
*/

// Teacher (User)
User.hasMany(SubjectAssignment, {
  foreignKey: "userId",
  as: "subjectAssignments",
});

SubjectAssignment.belongsTo(User, {
  foreignKey: "userId",
  as: "teacher",
});

// Class
Class.hasMany(SubjectAssignment, {
  foreignKey: "classId",
  as: "subjectAssignments",
});

SubjectAssignment.belongsTo(Class, {
  foreignKey: "classId",
  as: "class",
});

// Subject
Subject.hasMany(SubjectAssignment, {
  foreignKey: "subjectId",
  as: "subjectAssignments",
});

SubjectAssignment.belongsTo(Subject, {
  foreignKey: "subjectId",
  as: "subject",
});

// Session
Session.hasMany(SubjectAssignment, {
  foreignKey: "sessionId",
  as: "subjectAssignments",
});

SubjectAssignment.belongsTo(Session, {
  foreignKey: "sessionId",
  as: "session",
});

// Term
Term.hasMany(SubjectAssignment, {
  foreignKey: "termId",
  as: "subjectAssignments",
});

SubjectAssignment.belongsTo(Term, {
  foreignKey: "termId",
  as: "term",
});


// School has many Parents
School.hasMany(Parent, {
  foreignKey: "schoolId",
  as: "parents",
});

Parent.belongsTo(School, {
  foreignKey: "schoolId",
  as: "school",
});

// School has many Parent-Student relationships
School.hasMany(ParentStudent, {
  foreignKey: "schoolId",
  as: "parentStudentRelationships",
});

ParentStudent.belongsTo(School, {
  foreignKey: "schoolId",
  as: "school",
});

/*
|--------------------------------------------------------------------------
| Export Models
|--------------------------------------------------------------------------
*/

export {
  School,
  SubscriptionPlan,
  User,
  Student,
  Owner,
  Class,
  Subject,
  Session,
  Term,
  SubjectAssignment,
   Parent,
  ParentStudent,
};