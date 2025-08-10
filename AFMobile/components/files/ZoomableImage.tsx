import React, { useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  clamp
} from 'react-native-reanimated';

type Props = {
  uri: string;
  width: number;
  height: number;
  minScale?: number;
  maxScale?: number;
  onSingleTap?: () => void;
  onZoomChange?: (zoomed: boolean) => void;
};

const ZoomableImage: React.FC<Props> = ({
  uri,
  width,
  height,
  minScale = 1,
  maxScale = 5,
  onSingleTap,
  onZoomChange,
}) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Beregn grenser for panning basert på current scale
  const getBounds = (currentScale: number) => {
    'worklet';
    const scaledWidth = width * currentScale;
    const scaledHeight = height * currentScale;
    
    const maxX = Math.max(0, (scaledWidth - width) / 2);
    const maxY = Math.max(0, (scaledHeight - height) / 2);
    
    return { maxX, maxY };
  };

  // Begrens verdier innenfor grenser
  const constrainToBounds = (x: number, y: number, currentScale: number) => {
    'worklet';
    const { maxX, maxY } = getBounds(currentScale);
    return {
      x: clamp(x, -maxX, maxX),
      y: clamp(y, -maxY, maxY)
    };
  };

  // Single tap - enkel implementering
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .onEnd((_event, success) => {
      if (success && onSingleTap) {
        runOnJS(onSingleTap)();
      }
    });

  // Double tap - HØYESTE PRIORITET
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(300)
    .onEnd(() => {
      const currentScale = scale.value;
      const targetScale = currentScale > minScale ? minScale : maxScale / 2;
      
      console.log(`[ZoomableImage] Double tap - current: ${currentScale}, target: ${targetScale}`);
      
      scale.value = withSpring(targetScale, {
        damping: 20,
        stiffness: 300
      });
      
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);

      // Oppdater saved values
      savedScale.value = targetScale;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;

      if (onZoomChange) {
        runOnJS(onZoomChange)(targetScale > minScale);
      }
    });

  // Pinch - RIKTIG implementasjon med saved scale
  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      console.log(`[ZoomableImage] Pinch started at scale: ${scale.value}`);
    })
    .onUpdate((event) => {
      // Multipliser saved scale med event scale
      const newScale = clamp(
        savedScale.value * event.scale, 
        minScale, 
        maxScale
      );
      
      scale.value = newScale;

      // Juster posisjon hvis vi zoomer ut og er utenfor grenser
      if (newScale <= savedScale.value) {
        const constrained = constrainToBounds(
          translateX.value, 
          translateY.value, 
          newScale
        );
        translateX.value = constrained.x;
        translateY.value = constrained.y;
      }

      if (onZoomChange) {
        runOnJS(onZoomChange)(newScale > minScale);
      }
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      console.log(`[ZoomableImage] Pinch ended at scale: ${scale.value}`);
    });

  // Pan - MED BOUNDARY CONSTRAINTS
  const pan = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      if (scale.value > minScale) {
        console.log(`[ZoomableImage] Pan started (zoomed at ${scale.value}x)`);
      }
    })
    .onUpdate((event) => {
      // Kun tillat panning hvis vi er zoomet inn
      if (scale.value <= minScale) return;

      const newX = savedTranslateX.value + event.translationX;
      const newY = savedTranslateY.value + event.translationY;

      // Begrens til boundaries
      const constrained = constrainToBounds(newX, newY, scale.value);
      
      translateX.value = constrained.x;
      translateY.value = constrained.y;
    })
    .onEnd(() => {
      if (scale.value > minScale) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
        console.log(`[ZoomableImage] Pan ended at position: (${translateX.value.toFixed(1)}, ${translateY.value.toFixed(1)})`);
      }
    });

  // RIKTIG gesture prioritering - Race istedenfor Exclusive
  const composed = Gesture.Race(
    doubleTap, // Høyeste prioritet
    Gesture.Simultaneous(pinch, pan), // Kan skje samtidig
    singleTap // Laveste prioritet
  );

  // Reset når URI endres
  useEffect(() => {
    console.log(`[ZoomableImage] URI changed, resetting...`);
    scale.value = minScale;
    translateX.value = 0;
    translateY.value = 0;
    savedScale.value = minScale;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    
    if (onZoomChange) {
      onZoomChange(false);
    }
  }, [uri, minScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.wrapper, { width, height }]}>
        <Animated.Image
          source={{ uri }}
          style={[styles.image, { width, height }, animatedStyle]}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    backgroundColor: 'transparent',
  },
});

export default ZoomableImage;