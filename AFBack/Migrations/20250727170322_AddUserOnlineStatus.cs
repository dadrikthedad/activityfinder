using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class AddUserOnlineStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserOnlineStatuses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    DeviceId = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    LastSeen = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastBootstrapAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Platform = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    IsOnline = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    Capabilities = table.Column<string>(type: "text", nullable: false),
                    UserId1 = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserOnlineStatuses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserOnlineStatuses_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserOnlineStatuses_Users_UserId1",
                        column: x => x.UserId1,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserOnlineStatus_IsOnline",
                table: "UserOnlineStatuses",
                column: "IsOnline");

            migrationBuilder.CreateIndex(
                name: "IX_UserOnlineStatus_LastSeen",
                table: "UserOnlineStatuses",
                column: "LastSeen");

            migrationBuilder.CreateIndex(
                name: "IX_UserOnlineStatus_UserId",
                table: "UserOnlineStatuses",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserOnlineStatus_UserId_DeviceId",
                table: "UserOnlineStatuses",
                columns: new[] { "UserId", "DeviceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserOnlineStatuses_UserId1",
                table: "UserOnlineStatuses",
                column: "UserId1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserOnlineStatuses");
        }
    }
}
