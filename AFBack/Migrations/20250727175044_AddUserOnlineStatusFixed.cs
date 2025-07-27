using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class AddUserOnlineStatusFixed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserOnlineStatuses_Users_UserId1",
                table: "UserOnlineStatuses");

            migrationBuilder.DropIndex(
                name: "IX_UserOnlineStatuses_UserId1",
                table: "UserOnlineStatuses");

            migrationBuilder.DropColumn(
                name: "UserId1",
                table: "UserOnlineStatuses");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "UserId1",
                table: "UserOnlineStatuses",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserOnlineStatuses_UserId1",
                table: "UserOnlineStatuses",
                column: "UserId1");

            migrationBuilder.AddForeignKey(
                name: "FK_UserOnlineStatuses_Users_UserId1",
                table: "UserOnlineStatuses",
                column: "UserId1",
                principalTable: "Users",
                principalColumn: "Id");
        }
    }
}
