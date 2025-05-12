using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class LagtTilConversationTilMessageRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MessageRequests_Conversations_ConversationId",
                table: "MessageRequests");

            migrationBuilder.AddForeignKey(
                name: "FK_MessageRequests_Conversations_ConversationId",
                table: "MessageRequests",
                column: "ConversationId",
                principalTable: "Conversations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MessageRequests_Conversations_ConversationId",
                table: "MessageRequests");

            migrationBuilder.AddForeignKey(
                name: "FK_MessageRequests_Conversations_ConversationId",
                table: "MessageRequests",
                column: "ConversationId",
                principalTable: "Conversations",
                principalColumn: "Id");
        }
    }
}
