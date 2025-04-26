// Her har vi alle API-endepunktene våre, slik at vi sparer redudans

export const API_ROUTES = {
    userSettings: "/api/usersettings",
    profileSettings: "/api/user/profilesettings",
    login: "/api/auth/login",
    register: "/api/auth/register",
    publicProfile: (userId: number) => `/api/profile/${userId}`,

    // Venne-relatert
    friends: "/api/friends",
    friendsOfUser: (userId: number) => `/api/friends/of/${userId}`,
    isFriendWith: (otherUserId: number) => `/api/friends/is-friend-with/${otherUserId}`,
  
    // Venneforespørsler
    friendInvitations: {
      received: "/api/friendinvitations/received",
      send: "/api/friendinvitations",
      accept: (invitationId: number) => `/api/friendinvitations/${invitationId}/accept`,
      decline: (invitationId: number) => `/api/friendinvitations/${invitationId}/decline`,
      statusBetween: (otherUserId: number) => `/api/friendinvitations/between/${otherUserId}`,
    },
    // SignalR
    notificationHub: "/hubs/notifications",
    chatHub: "/chathub",
    // Notifications
    notifications: {
      markAllAsRead: "/api/notifications/mark-all-as-read",
      deleteAll: "/api/notifications/delete-all",
      page: "/api/notifications/page",
      navbar: "/api/notifications/navbar",
    },
  };


  // Her er url-ene vi kan sende rundt i frontend
  export const APP_ROUTES = {
    home: "/",
    profile: (id: number) => `/profile/${id}`,
    profileSettings: "/profilesettings",
    security: "/securitycred",
  };

  // Database URL-en

  export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net";