export default function errorHandler(err, req, res, next) {
  console.error("ERROR:", err);

  const statusCode = err.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    errors: err.errors || undefined,
  });
}
