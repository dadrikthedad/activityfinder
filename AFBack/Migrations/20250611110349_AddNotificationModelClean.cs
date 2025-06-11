using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationModelClean : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PostId",
                table: "Notifications",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CommentId",
                table: "Notifications",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FriendInvitationId",
                table: "Notifications",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EventInvitationId",
                table: "Notifications",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PostId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "CommentId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "FriendInvitationId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "EventInvitationId",
                table: "Notifications");
        }
    }
}