using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class IgnoreCanSendNavigationProperties : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Tom migration - vi vil bare fikse EF Core model, ikke database
            // Kolonnene ConversationId2 og UserId2 eksisterer ikke i databasen
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Tom migration
        }
    }
}
