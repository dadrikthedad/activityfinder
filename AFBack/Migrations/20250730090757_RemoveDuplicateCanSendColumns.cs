using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class RemoveDuplicateCanSendColumns : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConversationId1",
                table: "CanSend");
                
            migrationBuilder.DropColumn(
                name: "UserId1",
                table: "CanSend");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Tom - vi vil ikke legge tilbake disse kolonnene
        }
    }
}
