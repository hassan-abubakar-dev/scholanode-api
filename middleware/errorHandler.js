import dotenv from 'dotenv';
dotenv.config();
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

 if(process.env.NODE_ENV === 'development') {
    console.error('ERROR ', err);
    return res.status(statusCode).json({
      status: status,
      message: err.message,
      stack: err.stack,
      error: err,
    });
    } else if(process.env.NODE_ENV === 'production') {
    if (err.isOperational) {
      return res.status(statusCode).json({
        status: status,
        message: err.message,
      });
    }
    else {
      console.error('ERROR ', err);
      return res.status(500).json({
        status: 'error',
        message: 'Something went  wrong!',
      });
    }   


    }
};

export default errorHandler;