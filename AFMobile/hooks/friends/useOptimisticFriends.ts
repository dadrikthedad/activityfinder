// hooks/friends/useOptimisticFriends.ts
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useUserCacheStore } from '@/store/useUserCacheStore';
import { useAuth } from '@/context/AuthContext'; // NY IMPORT
import { FriendDTO } from '@shared/types/FriendDTO';

interface OptimisticFriend {
  id: number;
  isOptimistic: true;
  addedAt: number;
}

export const useOptimisticFriends = (actualFriends: FriendDTO[]) => {
  const [optimisticFriends, setOptimisticFriends] = useState<OptimisticFriend[]>([]);
  const [previousFriendIds, setPreviousFriendIds] = useState<Set<number>>(new Set());
  
  // Lyt på endringer i user cache store og auth
  const users = useUserCacheStore(state => state.users);
  const currentUser = useUserCacheStore(state => state.currentUser);
  const { token } = useAuth(); // NY: Lytt på token endringer
  
  // NY: Cleanup ved logout (når token blir null)
  useEffect(() => {
    if (!token) {
      console.log('👥 Token cleared - resetting optimistic friends');
      setOptimisticFriends([]);
      setPreviousFriendIds(new Set());
    }
  }, [token]);
  
  // Hovedlogikk for å oppdage nye venner
  useEffect(() => {
    if (!currentUser) return;
    
    // Finn alle som er markert som venner i cache
    const currentFriendIds = new Set(
      Object.values(users)
        .filter(user => user.isFriend === true && user.id !== currentUser.id) // Ikke inkluder current user
        .map(user => user.id)
    );
    
    // Finn nye venner (de som ikke var venner før og ikke allerede i actual friends)
    const actualFriendIds = new Set(actualFriends.map(f => f.friend.id));
    const existingOptimisticIds = new Set(optimisticFriends.map(f => f.id));
    
    const newFriendIds = Array.from(currentFriendIds).filter(id => 
      !previousFriendIds.has(id) && 
      !actualFriendIds.has(id) &&
      !existingOptimisticIds.has(id) // Ikke legg til duplikater
    );
    
    // Legg til nye optimistiske venner
    if (newFriendIds.length > 0) {
      const newOptimisticFriends = newFriendIds.map(id => ({
        id,
        isOptimistic: true as const,
        addedAt: Date.now()
      }));
      
      setOptimisticFriends(prev => [...prev, ...newOptimisticFriends]);
      
      console.log('👥 Added optimistic friends:', newFriendIds);
    }
    
    // Oppdater previous friend IDs kun hvis vi faktisk har endringer
    if (currentFriendIds.size !== previousFriendIds.size || 
        Array.from(currentFriendIds).some(id => !previousFriendIds.has(id))) {
      setPreviousFriendIds(currentFriendIds);
    }
  }, [users, actualFriends, currentUser, previousFriendIds, optimisticFriends]);
  
  // VIKTIG: Cleanup kun når optimistiske venner finnes i actual friends
  // ELLER når de ikke lenger er markert som venner i cache
  useEffect(() => {
    const actualFriendIds = new Set(actualFriends.map(f => f.friend.id));
    
    setOptimisticFriends(prev => {
      const filtered = prev.filter(optimistic => {
        // Fjern hvis finnes i actual friends
        if (actualFriendIds.has(optimistic.id)) {
          return false;
        }
        
        // NYTT: Fjern hvis ikke lenger markert som venn i cache
        const user = users[optimistic.id];
        if (!user || user.isFriend !== true) {
          console.log(`👥 Removing optimistic friend ${optimistic.id} - no longer marked as friend in cache`);
          return false;
        }
        
        return true;
      });
      
      if (filtered.length !== prev.length) {
        const removedCount = prev.length - filtered.length;
        const removedIds = prev.filter(opt => 
          actualFriendIds.has(opt.id) || 
          !users[opt.id] || 
          users[opt.id].isFriend !== true
        ).map(opt => opt.id);
        
        console.log(`👥 Removed ${removedCount} optimistic friends:`, removedIds);
      }
      
      return filtered;
    });
  }, [actualFriends, users]); // NYTT: Legg til users som dependency
  
  // FJERNET: Ingen TTL-basert cleanup lenger!
  
  // Lag falske FriendDTO objekter for optimistiske venner
  const createOptimisticFriendDTO = useCallback((userId: number): FriendDTO | null => {
    const user = users[userId];
    if (!user || !currentUser) {
      console.warn(`👥 Cannot create optimistic friend DTO for user ${userId} - missing data`);
      return null;
    }
    
    return {
      currentUserId: currentUser.id,
      createdAt: new Date().toISOString(), // Dagens dato
      userToFriendUserScore: 0, // Falsk score
      friendUserToUserScore: 0, // Falsk score
      friend: {
        id: user.id,
        fullName: user.fullName,
        profileImageUrl: user.profileImageUrl || null
      }
    };
  }, [users, currentUser]);
  
  // Kombiner actual friends med optimistiske venner (MED DEDUPLISERING)
  const combinedFriends = useMemo(() => {
    const friendMap = new Map<number, FriendDTO>();
    
    // Først, legg til alle actual friends (disse har prioritet)
    actualFriends.forEach(friend => {
      friendMap.set(friend.friend.id, friend);
    });
    
    // Så, legg til optimistiske venner (bare hvis de ikke allerede finnes)
    optimisticFriends.forEach(opt => {
      if (!friendMap.has(opt.id)) {
        const optimisticFriend = createOptimisticFriendDTO(opt.id);
        if (optimisticFriend) {
          friendMap.set(opt.id, optimisticFriend);
        }
      }
    });
    
    const result = Array.from(friendMap.values());
    
    // Debug logging
    if (optimisticFriends.length > 0) {
      console.log(`👥 Combined friends: ${actualFriends.length} actual + ${optimisticFriends.length} optimistic = ${result.length} total`);
      
      // Sjekk for duplikater
      const duplicateCheck = new Set();
      const duplicates = result.filter(f => {
        if (duplicateCheck.has(f.friend.id)) {
          return true;
        }
        duplicateCheck.add(f.friend.id);
        return false;
      });
      
      if (duplicates.length > 0) {
        console.error('👥 DUPLICATE FRIENDS DETECTED:', duplicates.map(f => f.friend.id));
      }
    }
    
    return result;
  }, [actualFriends, optimisticFriends, createOptimisticFriendDTO]);
  
  // Debug logging
  useEffect(() => {
    if (optimisticFriends.length > 0) {
      console.log(`👥 Current optimistic friends: ${optimisticFriends.length}`, 
        optimisticFriends.map(f => f.id));
    }
  }, [optimisticFriends]);
  
  return {
    friends: combinedFriends,
    hasOptimisticFriends: optimisticFriends.length > 0,
    optimisticFriendIds: optimisticFriends.map(f => f.id),
    optimisticCount: optimisticFriends.length,
    // Utility function for manual cleanup (for debug/testing)
    clearOptimisticFriends: () => {
      setOptimisticFriends([]);
      console.log('👥 Manually cleared all optimistic friends');
    }
  };
};