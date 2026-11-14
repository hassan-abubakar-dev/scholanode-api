import express from 'express';
import cors from './config/cors.js';
import cookieParser from "cookie-parser";
import { dbConnection, testConnection } from './config/db.js';
import "./relationships/associations.js";
import errorHandler from './middleware/errorHandler.js';
// socket.io routes
import { createServer } from "http";
import { initializeSocket } from "./config/socket.js";

// paystack webhook
import { handlePaystackWebhook } from './controllers/payment.js';

// import routes
import pricingRouter from './routes/pricing.js';
import schoolRouter from './routes/school.js';
import paymentRouter from './routes/payment.js';
import verificationRouter from './routes/verificationCode.js';
import authRouter from './routes/auth.js';
import academicSetupRouter from './routes/academicSetup.js';
import sessionTermRouter from './routes/sessionTerm.js';
import classRouter from './routes/class.js';
import subjectRouter from './routes/subject.js';
import staffRouter from './routes/staff.js';
import studentRouter from './routes/student.js';
import parentRouter from './routes/parent.js';
import attendanceRouter from './routes/attendance.js';
import gateSecurityRouter from './routes/gateSecurity.js';
import gateScannerRoutes from "./routes/gateScanner.js";
import compaintRouter from "./routes/complaint.js";
import timetableRouter from "./routes/timetable.js";
import supportRouter from "./routes/support.js";
import platformSupportRouter from "./routes/platformSupport.js";
import schoolInquiryRouter from "./routes/schoolInquiry.js";
import platformContactInquiryRouter from "./routes/platformContactInquiry.js";
import profileRouter from "./routes/profile.js";
import announcementRouter from "./routes/announcement.js"
import notificationRouter from "./routes/notification.js";
import classSubjectRouter from "./routes/classSubject.js";
import subscriptionRouter from "./routes/subscription.js";
import assessmentConfigurationRouter from "./routes/assessmentConfiguration.js";




const app = express();
const httpServer = createServer(app);

// CORS must run before application routes and body parsing.
app.use(cors);

// Paystack webhook must receive the raw request body.
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  handlePaystackWebhook
);

// Other middleware
app.use(express.json());
app.use(cookieParser());



// Basic route
app.get('/', (req, res) => {
    res.send('Server is running and accepting all origins.');
});

// routes
app.use('/api/plans', pricingRouter);
app.use('/api/schools', schoolRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/verifications', verificationRouter);
app.use('/api/auths', authRouter);
app.use('/api/academic-setup', academicSetupRouter);
app.use('/api/sessions-terms', sessionTermRouter);
app.use('/api/classes', classRouter);
app.use('/api/subjects', subjectRouter);
app.use('/api/staffs', staffRouter);
app.use('/api/students', studentRouter);
app.use('/api/parents', parentRouter);
app.use('/api/attendances', attendanceRouter);
app.use('/api/gate-securities', gateSecurityRouter); 
app.use("/api/gate-scanners", gateScannerRoutes);
app.use("/api/complaints", compaintRouter); 
app.use("/api/timetables", timetableRouter); 
app.use("/api/supports", supportRouter);
app.use("/api/platform-supports", platformSupportRouter);
app.use("/api/school-inquiries", schoolInquiryRouter);
app.use("/api/platform-contact-inquiries", platformContactInquiryRouter);
app.use("/api/profiles", profileRouter)
app.use("/api/announcements", announcementRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/class-subjects", classSubjectRouter);
app.use("/api/subscriptions", subscriptionRouter);
app.use("/api/assessment-configurations", assessmentConfigurationRouter);

// error handle
app.use(errorHandler);

// Database Connection and Server Startup
const PORT = process.env.PORT || 5000; 

// A listen failure arrives as an 'error' event, not a rejected promise, so the
// bootstrap try/catch below cannot see it. Without this handler Node rethrows it
// as an unhandled error and dumps a stack trace instead of a usable message.
httpServer.on("error", (error) => {
    console.error("\n❌ Failed to start server");

    if (error.code === "EADDRINUSE") {
        console.error(
            `Port ${PORT} is already in use. Another copy of this API is still running - stop it before starting this one.`
        );
        console.error(`Find the process holding it with: netstat -ano | findstr :${PORT}`);
    } else {
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
    }

    process.exit(1);
});

// Release the port on shutdown, otherwise a killed-but-not-exited process keeps
// it bound and the next start collides with EADDRINUSE.
const shutdown = (signal) => {
    console.log(`${signal} received, closing HTTP server...`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
};

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => shutdown(signal));
}

(async () => {
    try { 
        console.log("Testing database connection...");
        await testConnection();

       initializeSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log("Socket.IO is ready.");
});
    } catch (err) {
        console.error("\n❌ Failed to start server");
        console.error("Error name:", err.name);
        console.error("Error message:", err.message);
        console.error("Full error:", err);
        console.error("Stack trace:\n", err.stack);

        if (err.original) {
            console.error("Original database error:", err.original);
        }

        if (err.parent) {
            console.error("Parent database error:", err.parent);
        }

        process.exit(1);
    }
})();