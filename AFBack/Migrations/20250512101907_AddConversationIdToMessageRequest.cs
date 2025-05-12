using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class AddConversationIdToMessageRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ConversationId",
                table: "MessageRequests",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsRead",
                table: "MessageRequests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "LimitReached",
                table: "MessageRequests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_MessageRequests_ConversationId",
                table: "MessageRequests",
                column: "ConversationId");

            migrationBuilder.AddForeignKey(
                name: "FK_MessageRequests_Conversations_ConversationId",
                table: "MessageRequests",
                column: "ConversationId",
                principalTable: "Conversations",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MessageRequests_Conversations_ConversationId",
                table: "MessageRequests");

            migrationBuilder.DropIndex(
                name: "IX_MessageRequests_ConversationId",
                table: "MessageRequests");

            migrationBuilder.DropColumn(
                name: "ConversationId",
                table: "MessageRequests");

            migrationBuilder.DropColumn(
                name: "IsRead",
                table: "MessageRequests");

            migrationBuilder.DropColumn(
                name: "LimitReached",
                table: "MessageRequests");
        }
    }
}
