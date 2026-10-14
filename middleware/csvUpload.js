
import multer from "multer";
import path from "node:path";
import AppError from "../utils/AppError.js";

const createCsvUpload = ({ maxFileSize }) => {
  const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
      fileSize: maxFileSize,
      files: 1,
    },

    fileFilter: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();

      if (extension !== ".csv") {
        return callback(
          new AppError("Only CSV files are allowed.", 400)
        );
      }

      callback(null, true);
    },
  });

  return (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new AppError(
              "The uploaded CSV file exceeds the 2 MB size limit.",
              413
            )
          );
        }

        if (err.code === "LIMIT_FILE_COUNT") {
          return next(
            new AppError(
              "Only one CSV file can be uploaded at a time.",
              400
            )
          );
        }

        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(
            new AppError(
              "Unexpected file field. Use the 'file' field.",
              400
            )
          );
        }

        return next(new AppError("Invalid file upload.", 400));
      }

      if (err) {
        return next(err);
      }

      if (!req.file) {
        return next(
          new AppError("Please upload a CSV file.", 400)
        );
      }

      next();
    });
  };
};

export const uploadStaffCsv = createCsvUpload({
  maxFileSize: 2 * 1024 * 1024,
});

export const uploadStudentCsv = createCsvUpload({
  maxFileSize: 5 * 1024 * 1024, // 5 MB
});

export default createCsvUpload;
