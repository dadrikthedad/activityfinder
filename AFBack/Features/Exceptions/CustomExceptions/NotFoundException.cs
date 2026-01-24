namespace AFBack.Features.Exceptions.CustomExceptions;

public class NotFoundException(string message) : Exception(message)
{
    
}
