import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from "cookie-parser";
import { dbConnection, testConnection } from './config/db.js';
import "./relationships/associations.js";
import errorHandler from './middleware/errorHandler.js';

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




dotenv.config();

const app = express();

// Comma-separated list of exact browser origins allowed in production.
// Example: CLIENT_ORIGINS=https://app.scholanode.com,https://admin.scholanode.com
const configuredOrigins = String(process.env.CLIENT_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

// In development the frontend may be opened from localhost, a LAN IP (phone
// testing), or a tunnel, on any Vite port — so private-network origins are
// allowed there. Production only accepts CLIENT_ORIGINS.
const isLocalDevelopmentOrigin = (origin) => {
  try {
    const { hostname } = new URL(origin);

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  } catch {
    return false;
  }
};

// before express.json() middleware, set up CORS
app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json" }),
    handlePaystackWebhook

);


// Middleware
app.use(express.json());

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without an Origin header, such as Postman or curl.
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, "");

      if (configuredOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      if (
        process.env.NODE_ENV !== "production" &&
        isLocalDevelopmentOrigin(normalizedOrigin)
      ) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },

    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


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


// error handle
app.use(errorHandler);

// Database Sync and Server Startup
const PORT = process.env.PORT || 5000; 


(async () => {
    try {
        console.log("Testing database connection...");
        await testConnection();

        console.log("Synchronizing database models...");
        await dbConnection.sync();

        console.log("Database connected and models synced successfully.");

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
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