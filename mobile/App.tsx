// mobile/App.tsx
import React, { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StatusBar, View } from "react-native";
import { LoginScreen } from "./src/screens/LoginScreen";
import { CreateWorkspaceScreen } from "./src/screens/CreateWorkspaceScreen";
import { WorkspacesScreen } from "./src/screens/WorkspacesScreen";
import { WorkspaceScreen } from "./src/screens/WorkspaceScreen";
import { StatisticsQuestionsScreen } from "./src/screens/StatisticsQuestionsScreen";
import { StatisticsVisualScreen } from "./src/screens/StatisticsVisualScreen";
import { StatisticsReport } from "./src/features/statistics/statistics";
import { colors } from "./src/theme";
import { Workspace } from "./src/api";
import { loadToken, saveToken, clearToken } from "./src/session";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [statisticsStep, setStatisticsStep] = useState<"questions" | "visual" | null>(null);
  const [statisticsReport, setStatisticsReport] = useState<StatisticsReport | null>(null);

  useEffect(() => {
    loadToken()
      .then((saved) => {
        if (saved) setToken(saved);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  const handleSignedIn = (newToken: string) => {
    setToken(newToken);
    saveToken(newToken);
  };

  const handleSignOut = () => {
    clearToken();
    setToken(null);
    setWorkspace(null);
    setCreatingWorkspace(false);
    setStatisticsStep(null);
    setStatisticsReport(null);
  };

  let screen: React.ReactNode;
  if (checkingSession) {
    screen = (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  } else if (!token) {
    screen = <LoginScreen onSignedIn={handleSignedIn} />;
  } else if (workspace && statisticsStep === "questions") {
    screen = (
      <StatisticsQuestionsScreen
        token={token}
        workspace={workspace}
        initialQuery={statisticsReport?.query}
        onBack={() => {
          setStatisticsStep(null);
          setStatisticsReport(null);
        }}
        onGenerate={(report) => {
          setStatisticsReport(report);
          setStatisticsStep("visual");
        }}
      />
    );
  } else if (workspace && statisticsStep === "visual" && statisticsReport) {
    screen = (
      <StatisticsVisualScreen
        workspace={workspace}
        report={statisticsReport}
        onBack={() => setStatisticsStep("questions")}
        onClose={() => {
          setStatisticsStep(null);
          setStatisticsReport(null);
        }}
      />
    );
  } else if (workspace) {
    screen = (
      <WorkspaceScreen
        token={token}
        workspace={workspace}
        onBackToWorkspaces={() => {
          setWorkspace(null);
          setStatisticsStep(null);
          setStatisticsReport(null);
        }}
        onOpenStatistics={() => setStatisticsStep("questions")}
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
        onSelect={(selectedWorkspace) => {
          setWorkspace(selectedWorkspace);
          setStatisticsStep(null);
          setStatisticsReport(null);
        }}
        onCreate={() => setCreatingWorkspace(true)}
        onSignOut={handleSignOut}
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