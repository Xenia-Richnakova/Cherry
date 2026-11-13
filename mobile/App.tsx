// mobile/App.tsx
import React, { useState } from "react";
import { SafeAreaView, StatusBar } from "react-native";
import { LoginScreen } from "./src/screens/LoginScreen";
import { CreateWorkspaceScreen } from "./src/screens/CreateWorkspaceScreen";
import { WorkspacesScreen } from "./src/screens/WorkspacesScreen";
import { WorkspaceScreen } from "./src/screens/WorkspaceScreen";
import { colors } from "./src/theme";
import { Workspace } from "./src/api";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  let screen: React.ReactNode;
  if (!token) {
    screen = <LoginScreen onSignedIn={setToken} />;
  } else if (workspace) {
    screen = (
      <WorkspaceScreen
        token={token}
        workspace={workspace}
        onBackToWorkspaces={() => setWorkspace(null)}
      />
    );
  } else if (creatingWorkspace) {
    screen = (
      <CreateWorkspaceScreen
        token={token}
        onCreated={(createdWorkspace) => {
          setWorkspace(createdWorkspace);
          setCreatingWorkspace(false);
        }}
        onCancel={() => setCreatingWorkspace(false)}
      />
    );
  } else {
    screen = (
      <WorkspacesScreen
        token={token}
        onSelect={setWorkspace}
        onCreate={() => setCreatingWorkspace(true)}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      {screen}
    </SafeAreaView>
  );
}

