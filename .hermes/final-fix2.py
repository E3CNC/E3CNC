import os

base = "/Users/isaaceliape/repos/e3cnc/src/store"

# Fix editor/mutations.ts
fp = os.path.join(base, "editor/mutations.ts")
with open(fp) as f:
    content = f.read()
content = content.replace(
    "updateCancelTokenSource(state: EditorState, source) {",
    "updateCancelTokenSource(state: EditorState, source: any) {")
content = content.replace(
    "updateLoaderState(state: EditorState, value) {",
    "updateLoaderState(state: EditorState, value: any) {")
content = content.replace(
    "setFilename(state: EditorState, filename) {",
    "setFilename(state: EditorState, filename: any) {")
content = content.replace(
    "setPermissions(state: EditorState, filename) {",
    "setPermissions(state: EditorState, filename: any) {")
with open(fp, "w") as f:
    f.write(content)
print("FIXED editor/mutations.ts")

# Fix farm/printer/actions.ts
fp = os.path.join(base, "farm/printer/actions.ts")
with open(fp) as f:
    content = f.read()
content = content.replace(
    "sendBatch({ commit }: ActionContext<FarmPrinterState, RootState>, data: any)",
    "sendBatch({ commit, rootGetters }: ActionContext<FarmPrinterState, RootState>, data: any)")
content = content.replace(
    "const requestIndex = state.socket.wsData.findIndex((item)",
    "const requestIndex = state.socket.wsData.findIndex((item: any)")
with open(fp, "w") as f:
    f.write(content)
print("FIXED farm/printer/actions.ts")

# Fix farm/printer/mutations.ts
fp = os.path.join(base, "farm/printer/mutations.ts")
with open(fp) as f:
    content = f.read()
content = content.replace(
    "state.socket[key] = value",
    "(state.socket as Record<string, any>)[key] = value")
content = content.replace(
    "removeWsData(state: FarmPrinterState, index) {",
    "removeWsData(state: FarmPrinterState, index: any) {")
with open(fp, "w") as f:
    f.write(content)
print("FIXED farm/printer/mutations.ts")

# Fix gui/index.ts
fp = os.path.join(base, "gui/index.ts")
with open(fp) as f:
    content = f.read()
content = content.replace(
    "bigThumbnailBackground: defaultBigThumbnailBackground,",
    "// bigThumbnailBackground: defaultBigThumbnailBackground,")
with open(fp, "w") as f:
    f.write(content)
print("FIXED gui/index.ts")

# Fix gui/maintenance/actions.ts
fp = os.path.join(base, "gui/maintenance/actions.ts")
with open(fp) as f:
    content = f.read()
content = content.replace(
    "perform({ dispatch, state, rootState }, payload: { id: string; note: string; remind: boolean }) {",
    "perform({ dispatch, state, rootState }: ActionContext<GuiMaintenanceState, RootState>, payload: { id: string; note: string; remind: boolean }) {")
with open(fp, "w") as f:
    f.write(content)
print("FIXED gui/maintenance/actions.ts")

# Fix gui/navigation/actions.ts
fp = os.path.join(base, "gui/navigation/actions.ts")
with open(fp) as f:
    content = f.read()
content = content.replace(
    "updatePos({ commit }, payload: GuiNavigationStateEntry) {",
    "updatePos({ commit }: ActionContext<GuiNavigationState, RootState>, payload: GuiNavigationStateEntry) {")
content = content.replace(
    "changeVisibility({ commit, dispatch }, payload: NaviPoint) {",
    "changeVisibility({ commit, dispatch }: ActionContext<GuiNavigationState, RootState>, payload: NaviPoint) {")
with open(fp, "w") as f:
    f.write(content)
print("FIXED gui/navigation/actions.ts")

# Fix gui/webcams/getters.ts
fp = os.path.join(base, "gui/webcams/getters.ts")
with open(fp) as f:
    content = f.read()
content = content.replace(
    "getWebcam: (_, getters) => (name: string) => {",
    "getWebcam: (_state: GuiWebcamState, getters: any) => (name: string) => {")
with open(fp, "w") as f:
    f.write(content)
print("FIXED gui/webcams/getters.ts")

# Fix server/history/actions.ts
fp = os.path.join(base, "server/history/actions.ts")
with open(fp) as f:
    content = f.read()
content = content.replace(
    "state.jobs.findIndex((stateJob) => stateJob.job_id",
    "state.jobs.findIndex((stateJob: any) => stateJob.job_id")
content = content.replace(
    "saveHistoryNote({ commit }, payload: { job_id: string; note: string }) {",
    "saveHistoryNote({ commit }: ActionContext<ServerHistoryState, RootState>, payload: { job_id: string; note: string }) {")
with open(fp, "w") as f:
    f.write(content)
print("FIXED server/history/actions.ts")

# Fix socket/actions.ts
fp = os.path.join(base, "socket/actions.ts")
with open(fp) as f:
    content = f.read()
content = content.replace(
    "addLoading({ commit }, payload: string) {",
    "addLoading({ commit }: ActionContext<SocketState, RootState>, payload: string) {")
content = content.replace(
    "removeLoading({ commit }, payload: string) {",
    "removeLoading({ commit }: ActionContext<SocketState, RootState>, payload: string) {")
with open(fp, "w") as f:
    f.write(content)
print("FIXED socket/actions.ts")

# Fix state[key] = value patterns
for fn in ["socket/mutations.ts", "server/mutations.ts"]:
    fp = os.path.join(base, fn)
    with open(fp) as f:
        content = f.read()
    content = content.replace(
        'state[key] = value',
        '(state as Record<string, any>)[key] = value')
    with open(fp, "w") as f:
        f.write(content)
    print(f"FIXED {fn}")

# Fix gui/mutations.ts
fp = os.path.join(base, "gui/mutations.ts")
with open(fp) as f:
    content = f.read()
content = content.replace(
    "state.dashboard[payload.layoutname as keyof GuiStateDashboard] = payload.value",
    "(state.dashboard as any)[payload.layoutname] = payload.value")
content = content.replace(
    "state.view.tempchart.datasetSettings[payload.objectName]",
    "(state.view.tempchart.datasetSettings as Record<string, any>)[payload.objectName]")
with open(fp, "w") as f:
    f.write(content)
print("FIXED gui/mutations.ts")

print("\nAll fixes applied!")
