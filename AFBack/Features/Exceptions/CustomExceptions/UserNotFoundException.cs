namespace AFBack.Features.Exceptions.CustomExceptions;

public class UserNotFoundException(string message) : Exception(message);
