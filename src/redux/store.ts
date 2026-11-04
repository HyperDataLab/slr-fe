import {
  combineReducers,
  configureStore,
  type Middleware,
  type UnknownAction,
} from "@reduxjs/toolkit";
import { 
  persistStore, 
  persistReducer, 
  type PersistConfig,
  createTransform,
  createMigrate
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import type { PersistedState } from "redux-persist";
import authReducer from "./slices/authSlice";
import uiReducer from "./slices/uiSlice";
import projectReducer from "./slices/projectSlice";
import documentEditorReducer from "./slices/documentEditorSlice";
import { queryClient } from "../config/queryClient";
import type { AuthState } from "../types/auth";

/**
 * Persist Transform: Blacklist volatile fields from the auth slice.
 * We don't want to persist 'isInitialized' as it should always start false 
 * on a fresh application load.
 */
const authTransform = createTransform(
  (inboundState: AuthState) => ({ ...inboundState, isInitialized: false }),
  (outboundState) => outboundState,
  { whitelist: ["auth"] }
);

// Membership is authorization-derived server state. Keep it in Redux while the
// app is open for existing consumers, but never restore a stale role from disk.
const projectTransform = createTransform(
  (inboundState: { currentProjectMember?: unknown }) => ({
    ...inboundState,
    currentProjectMember: null,
  }),
  (outboundState: { currentProjectMember?: unknown }) => ({
    ...outboundState,
    currentProjectMember: null,
  }),
  { whitelist: ["project"] },
);

/**
 * Migration: Handle state transitions between versions.
 * This is useful for clearing stale data after significant architecture changes.
 */
const migrations = {
  0: (state: PersistedState): PersistedState =>
    state
      ? ({ ...state, auth: undefined } as PersistedState)
      : state, // Reset auth if coming from unversioned/double-persisted state
};

const appReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  project: projectReducer,
  documentEditor: documentEditorReducer,
});

/**
 * Root Reducer with Reset Logic
 * When auth/logout is dispatched, we reset the entire state to undefined,
 * which forces all slices to return to their initialState.
 */
const rootReducer = (
  state: ReturnType<typeof appReducer> | undefined,
  action: UnknownAction,
) => {
  if (action.type === "auth/logout") {
    state = undefined;
  }
  return appReducer(state, action);
};

const persistConfig: PersistConfig<ReturnType<typeof appReducer>> = {
  key: "root",
  version: 1,
  storage,
  whitelist: ["auth", "ui", "project", "documentEditor"],
  transforms: [authTransform, projectTransform],
  migrate: createMigrate(migrations, { debug: false }),
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const logoutCleanupMiddleware: Middleware = () => (next) => (action) => {
  if (
    typeof action === "object" &&
    action !== null &&
    "type" in action &&
    action.type === "auth/logout"
  ) {
    queryClient.clear();
    persistor.purge();
    // Manually clear old legacy persist key if it exists
    localStorage.removeItem("persist:auth");
  }
  return next(action);
};

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(logoutCleanupMiddleware),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
