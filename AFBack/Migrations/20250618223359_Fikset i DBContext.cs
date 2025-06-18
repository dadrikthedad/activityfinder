using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class FiksetiDBContext : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GroupRequests_Conversations_ConversationId",
                table: "GroupRequests");

            migrationBuilder.AddForeignKey(
                name: "FK_GroupRequests_Conversations_ConversationId",
                table: "GroupRequests",
                column: "ConversationId",
                principalTable: "Conversations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GroupRequests_Conversations_ConversationId",
                table: "GroupRequests");

            migrationBuilder.AddForeignKey(
                name: "FK_GroupRequests_Conversations_ConversationId",
                table: "GroupRequests",
                column: "ConversationId",
                principalTable: "Conversations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
