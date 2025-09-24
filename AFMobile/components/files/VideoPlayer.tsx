// components/common/VideoPlayer.tsx
import React, { useEffect } from 'react';
import { VideoView, useVideoPlayer, VideoSource } from 'expo-video';

interface VideoPlayerProps {
  source: VideoSource;
  onPlayerReady: (player: any) => void;
  dimensions: { width: number; height: number };
}

const VideoPlayer = React.memo<VideoPlayerProps>(({ 
  source, 
  onPlayerReady, 
  dimensions 
}) => {
  console.log('🎬 VideoPlayer render - should only happen once per video');
  
  const player = useVideoPlayer(source, (player) => {
    player.loop = false;
    player.muted = false;
    player.timeUpdateEventInterval = 0.1;
  });

  useEffect(() => {
    onPlayerReady(player);
  }, [player, onPlayerReady]);

  return (
    <VideoView
      style={{ 
        width: dimensions.width, 
        height: dimensions.height, 
        backgroundColor: 'black' 
      }}
      player={player}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
      showsTimecodes={false}
      requiresLinearPlayback={false}
      contentFit="contain"
      nativeControls={false}
    />
  );
}, (prevProps, nextProps) => {
  // Bare re-render hvis video source endres
  return prevProps.source === nextProps.source;
});

export default VideoPlayer;