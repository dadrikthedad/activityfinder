namespace AFBack.Common;

public enum ErrorTypeEnum
{
    BadRequest = 400,
    Unauthorized = 401,
    Forbidden = 403,
    NotFound = 404,
    Conflict = 409,
    Gone = 410,
    Validation = 422, 
    InternalServerError = 500
}
