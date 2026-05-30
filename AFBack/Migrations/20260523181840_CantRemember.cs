using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class CantRemember : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastLoginMfaCodeSentAt",
                table: "VerificationInfos",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LoginMfaCode",
                table: "VerificationInfos",
                type: "character varying(6)",
                maxLength: 6,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LoginMfaCodeExpiresAt",
                table: "VerificationInfos",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LoginMfaCodeFailedAttempts",
                table: "VerificationInfos",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastLoginMfaCodeSentAt",
                table: "VerificationInfos");

            migrationBuilder.DropColumn(
                name: "LoginMfaCode",
                table: "VerificationInfos");

            migrationBuilder.DropColumn(
                name: "LoginMfaCodeExpiresAt",
                table: "VerificationInfos");

            migrationBuilder.DropColumn(
                name: "LoginMfaCodeFailedAttempts",
                table: "VerificationInfos");
        }
    }
}
