import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import SignalScreen from "../screens/SignalScreen";

export type RootStackParamList = {
  Home: undefined;
  Signal: { stock: any };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const StackNavigator = () => (
  <Stack.Navigator initialRouteName="Home">
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="Signal" component={SignalScreen} />
  </Stack.Navigator>
);

export default StackNavigator;
