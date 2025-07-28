using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AFBack.Migrations
{
    /// <inheritdoc />
    public partial class UpdatedUserOnlineWithWebsocket : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ConnectionId",
                table: "UserOnlineStatuses",
                type: "varchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConnectionMetadata",
                table: "UserOnlineStatuses",
                type: "text",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisconnectionReason",
                table: "UserOnlineStatuses",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsWebSocketConnected",
                table: "UserOnlineStatuses",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastHeartbeat",
                table: "UserOnlineStatuses",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReconnectionAttempts",
                table: "UserOnlineStatuses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "WebSocketConnectedAt",
                table: "UserOnlineStatuses",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "WebSocketDisconnectedAt",
                table: "UserOnlineStatuses",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserOnlineStatus_ConnectionId",
                table: "UserOnlineStatuses",
                column: "ConnectionId");

            migrationBuilder.CreateIndex(
                name: "IX_UserOnlineStatus_IsWebSocketConnected",
                table: "UserOnlineStatuses",
                column: "IsWebSocketConnected");

            migrationBuilder.CreateIndex(
                name: "IX_UserOnlineStatus_WebSocket_ConnectedAt",
                table: "UserOnlineStatuses",
                columns: new[] { "IsWebSocketConnected", "WebSocketConnectedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserOnlineStatus_ConnectionId",
                table: "UserOnlineStatuses");

            migrationBuilder.DropIndex(
                name: "IX_UserOnlineStatus_IsWebSocketConnected",
                table: "UserOnlineStatuses");

            migrationBuilder.DropIndex(
                name: "IX_UserOnlineStatus_WebSocket_ConnectedAt",
                table: "UserOnlineStatuses");

            migrationBuilder.DropColumn(
                name: "ConnectionId",
                table: "UserOnlineStatuses");

            migrationBuilder.DropColumn(
                name: "ConnectionMetadata",
                table: "UserOnlineStatuses");

            migrationBuilder.DropColumn(
                name: "DisconnectionReason",
                table: "UserOnlineStatuses");

            migrationBuilder.DropColumn(
                name: "IsWebSocketConnected",
                table: "UserOnlineStatuses");

            migrationBuilder.DropColumn(
                name: "LastHeartbeat",
                table: "UserOnlineStatuses");

            migrationBuilder.DropColumn(
                name: "ReconnectionAttempts",
                table: "UserOnlineStatuses");

            migrationBuilder.DropColumn(
                name: "WebSocketConnectedAt",
                table: "UserOnlineStatuses");

            migrationBuilder.DropColumn(
                name: "WebSocketDisconnectedAt",
                table: "UserOnlineStatuses");
        }
    }
}
