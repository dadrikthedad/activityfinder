using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class AddReportTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserBlock_Users_BlockedUserId",
                table: "UserBlock");

            migrationBuilder.DropForeignKey(
                name: "FK_UserBlock_Users_BlockerId",
                table: "UserBlock");

            migrationBuilder.DropPrimaryKey(
                name: "PK_UserBlock",
                table: "UserBlock");

            migrationBuilder.RenameTable(
                name: "UserBlock",
                newName: "UserBlocks");

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserBlocks",
                table: "UserBlocks",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "Reports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: false),
                    SubmittedByUserId = table.Column<int>(type: "integer", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    ReportedUserId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    StepsToReproduce = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ExpectedBehavior = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ActualBehavior = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    BrowserVersion = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DeviceInfo = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Priority = table.Column<int>(type: "integer", nullable: false, defaultValue: 2),
                    Status = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AssignedTo = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Resolution = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    AttachmentsJson = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reports", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Report_Status",
                table: "Reports",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Report_SubmittedAt",
                table: "Reports",
                column: "SubmittedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Report_SubmittedByUserId",
                table: "Reports",
                column: "SubmittedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Report_Type",
                table: "Reports",
                column: "Type");

            migrationBuilder.CreateIndex(
                name: "IX_Report_Type_Status",
                table: "Reports",
                columns: new[] { "Type", "Status" });

            migrationBuilder.AddForeignKey(
                name: "FK_UserBlocks_Users_BlockedUserId",
                table: "UserBlocks",
                column: "BlockedUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserBlocks_Users_BlockerId",
                table: "UserBlocks",
                column: "BlockerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserBlocks_Users_BlockedUserId",
                table: "UserBlocks");

            migrationBuilder.DropForeignKey(
                name: "FK_UserBlocks_Users_BlockerId",
                table: "UserBlocks");

            migrationBuilder.DropTable(
                name: "Reports");

            migrationBuilder.DropPrimaryKey(
                name: "PK_UserBlocks",
                table: "UserBlocks");

            migrationBuilder.RenameTable(
                name: "UserBlocks",
                newName: "UserBlock");

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserBlock",
                table: "UserBlock",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_UserBlock_Users_BlockedUserId",
                table: "UserBlock",
                column: "BlockedUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserBlock_Users_BlockerId",
                table: "UserBlock",
                column: "BlockerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
