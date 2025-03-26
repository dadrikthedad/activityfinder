using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileAndSettingsTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Community_Profile_ProfileUserId",
                table: "Community");

            migrationBuilder.DropForeignKey(
                name: "FK_Profile_Users_UserId",
                table: "Profile");

            migrationBuilder.DropForeignKey(
                name: "FK_UserActivity_Profile_ProfileUserId",
                table: "UserActivity");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Profile",
                table: "Profile");

            migrationBuilder.DropColumn(
                name: "LastSeen",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "DisplayName",
                table: "Profile");

            migrationBuilder.DropColumn(
                name: "LastSeen",
                table: "Profile");

            migrationBuilder.DropColumn(
                name: "Location",
                table: "Profile");

            migrationBuilder.RenameTable(
                name: "Profile",
                newName: "Profiles");

            migrationBuilder.RenameColumn(
                name: "ShowProfileImage",
                table: "UserSettings",
                newName: "ShowRegion");

            migrationBuilder.AddColumn<bool>(
                name: "PublicProfile",
                table: "UserSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RecieveEmailNotifications",
                table: "UserSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RecievePushNotifications",
                table: "UserSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ShowGender",
                table: "UserSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "Users",
                type: "varchar(20)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastLoginCity",
                table: "Users",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastLoginCountry",
                table: "Users",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastLoginIp",
                table: "Users",
                type: "character varying(45)",
                maxLength: 45,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastLoginRegion",
                table: "Users",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastSeen",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TotalMessagesRecieved",
                table: "Profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TotalMessagesSendt",
                table: "Profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddPrimaryKey(
                name: "PK_Profiles",
                table: "Profiles",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Community_Profiles_ProfileUserId",
                table: "Community",
                column: "ProfileUserId",
                principalTable: "Profiles",
                principalColumn: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Profiles_Users_UserId",
                table: "Profiles",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserActivity_Profiles_ProfileUserId",
                table: "UserActivity",
                column: "ProfileUserId",
                principalTable: "Profiles",
                principalColumn: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Community_Profiles_ProfileUserId",
                table: "Community");

            migrationBuilder.DropForeignKey(
                name: "FK_Profiles_Users_UserId",
                table: "Profiles");

            migrationBuilder.DropForeignKey(
                name: "FK_UserActivity_Profiles_ProfileUserId",
                table: "UserActivity");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Profiles",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "PublicProfile",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "RecieveEmailNotifications",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "RecievePushNotifications",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "ShowGender",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastLoginCity",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastLoginCountry",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastLoginIp",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastLoginRegion",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastSeen",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TotalMessagesRecieved",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "TotalMessagesSendt",
                table: "Profiles");

            migrationBuilder.RenameTable(
                name: "Profiles",
                newName: "Profile");

            migrationBuilder.RenameColumn(
                name: "ShowRegion",
                table: "UserSettings",
                newName: "ShowProfileImage");

            migrationBuilder.AddColumn<DateTime>(
                name: "LastSeen",
                table: "UserSettings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                table: "Profile",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastSeen",
                table: "Profile",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Location",
                table: "Profile",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_Profile",
                table: "Profile",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Community_Profile_ProfileUserId",
                table: "Community",
                column: "ProfileUserId",
                principalTable: "Profile",
                principalColumn: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Profile_Users_UserId",
                table: "Profile",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserActivity_Profile_ProfileUserId",
                table: "UserActivity",
                column: "ProfileUserId",
                principalTable: "Profile",
                principalColumn: "UserId");
        }
    }
}
