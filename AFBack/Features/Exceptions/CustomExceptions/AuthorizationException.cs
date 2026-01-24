namespace AFBack.Features.Exceptions.CustomExceptions;

public class AuthorizationException(string message) : Exception(message);
