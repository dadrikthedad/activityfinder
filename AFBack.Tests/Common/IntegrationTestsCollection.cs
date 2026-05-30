namespace AFBack.Tests.Common;

/// <summary>
/// Sikrer at alle integrasjonstester i samlingen deler en enkelt BackendApplicationFactory-instans.
/// En container-instans per testkjoring — ikke per test.
/// </summary>
[CollectionDefinition(nameof(IntegrationTestsCollection))]
public class IntegrationTestsCollection : ICollectionFixture<BackendApplicationFactory>;
