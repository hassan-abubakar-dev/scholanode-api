import dotenv from 'dotenv';
dotenv.config();
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';
  const isDevelopment = process.env.NODE_ENV !== 'production';

  console.error('ERROR ', {
    method: req.method,
    url: req.originalUrl,
    error: err,
  });

  if (isDevelopment) {
    return res.status(statusCode).json({
      status: status,
      message: err.message,
      stack: err.stack,
      error: err,
    });
  }

  if (err.isOperational) {
    return res.status(statusCode).json({
      status,
      message: err.message,
    });
  }

  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong!',
  });
};

export default errorHandler;