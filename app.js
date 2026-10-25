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




dotenv.config();

const app = express();

// before express.json() middleware, set up CORS to allow requests from http://localhost:5173
app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json" }),
    handlePaystackWebhook

);


// Middleware
app.use(express.json());

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // This allows 'http://localhost:5173' and 'http://localhost:5173/'
        if (origin.startsWith('http://localhost:5173')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

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
// error handle
app.use(errorHandler);

// Database Sync and Server Startup
const PORT = process.env.PORT || 5000;


(async () => {
    try {
        await testConnection();
        await dbConnection.sync(); // Use { force: true } for development to drop and recreate tables
        console.log('Database connected and models synced successfully.');

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err.message);
    }
})();