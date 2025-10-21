import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import StackNavigator from "./components/navigation/StackNavigator

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <NavigationContainer>
      {children}
      <StackNavigator />
    </NavigationContainer>
  );
}
