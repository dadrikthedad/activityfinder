import React from 'react';
import { View, Text, StyleSheet } from 'react-native';


export const TestScreen: React.FC = () => {
return (
<View style={styles.container}>
<Text style={styles.title}>Hello World</Text>
</View>
);
};


const styles = StyleSheet.create({
container: {
flex: 1,
alignItems: 'center',
justifyContent: 'center',
backgroundColor: '#ffffff',
},
title: {
fontSize: 24,
fontWeight: '600',
},
});