import {
  Action,
  ActionPanel,
  Application,
  Color,
  Form,
  Icon,
  List,
  LaunchProps,
  LocalStorage,
  Toast,
  clearSearchBar,
  confirmAlert,
  getApplications,
  open,
  showHUD,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";

import { v4 as uuid } from "uuid";
import xorby from "lodash.xorby";
import { URL } from "url";

import { Preset, PresetFormValues } from "./types";

const StringIndexableIcon = Icon as { [index: string]: string };
const StringIndexableColor = Color as { [index: string]: string };

type PresetsDraftValues = {
  name?: string;
  icon?: string;
  color?: string;
  [key: string]: unknown;
};

const CreateOrEditPresetName = (props: {
  name?: string;
  icon: string | undefined;
  color: string | undefined;
  draftValues?: PresetsDraftValues;
  editing?: boolean;
  onCreateOrEditPresetName: (name: string, icon: string, color: string) => void;
}) => {
  const [error, setError] = useState<string | undefined>(undefined);

  const defaultName = !props.editing ? (props.draftValues?.name as string | undefined) ?? props.name : props.name;
  const defaultIcon = !props.editing
    ? (props.draftValues?.icon as string | undefined) ?? props.icon ?? "CircleFilled"
    : props.icon ?? "CircleFilled";
  const defaultColor = !props.editing
    ? (props.draftValues?.color as string | undefined) ?? props.color ?? "Orange"
    : props.color ?? "Orange";

  const handleOnCreateOrEditPresetName = (values: PresetFormValues) => {
    if (values.name === "") {
      return setError("Name is required");
    }

    props.onCreateOrEditPresetName(values.name, values.icon, values.color);
  };

  const handleNameError = (value: string) => {
    if (!value?.length) {
      setError("Name is required");
    } else {
      setError(undefined);
    }
  };

  return (
    <Form
      navigationTitle="Create Preset: (2/2)"
      enableDrafts={!props.editing}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Preset" icon={Icon.SaveDocument} onSubmit={handleOnCreateOrEditPresetName} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Name"
        defaultValue={defaultName}
        placeholder="My New Preset"
        autoFocus={true}
        error={error}
        onChange={(value: string) => handleNameError(value)}
        onBlur={(event: Form.Event<string>) => handleNameError(event.target.value as string)}
      />
      <Form.Dropdown id="icon" title="Icon" defaultValue={defaultIcon}>
        {Object.keys(Icon).map((icon) => (
          <Form.Dropdown.Item key={icon} title={icon} value={icon} icon={StringIndexableIcon[icon]} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown id="color" title="Color" defaultValue={defaultColor}>
        {Object.keys(Color).map((color) => (
          <Form.Dropdown.Item
            key={color}
            title={color}
            value={color}
            icon={{ source: Icon.CircleFilled, tintColor: StringIndexableColor[color] }}
          />
        ))}
      </Form.Dropdown>
    </Form>
  );
};

const CreateOrEditPreset = (props: {
  preset?: Preset;
  draftValues?: PresetsDraftValues;
  onCreateOrEditPreset: (preset: Preset) => void;
  editing?: boolean;
}) => {
  const [apps, setApps] = useState<Application[]>([]);
  const [selectedApps, setSelectedApps] = useState<Application[]>([]);
  const [selectedURLs, setSelectedURLs] = useState<string[]>([]);

  const [hasSetApps, setHasSetApps] = useState(false);

  const { push, pop } = useNavigation();

  useEffect(() => {
    (async () => {
      try {
        const installedApplications: Application[] = await getApplications();

        const appNameSort = (a: Application, b: Application) => a.name.localeCompare(b.name);

        setApps(installedApplications.sort(appNameSort));

        setHasSetApps(true);
      } catch (_) {
        showToast({
          title: "Error",
          message: "Could not load Apps",
          style: Toast.Style.Failure,
        });
      }

      // pre-load apps on 'edit'
      if (props.editing && props.preset?.apps?.length) {
        setSelectedApps(props.preset.apps);
      }

      // pre-load urls on 'edit'
      if (props.editing && props.preset?.urls?.length) {
        setSelectedURLs(props.preset.urls);
      }
    })();
  }, []);

  const toggleApp = (app: Application) => {
    setSelectedApps((selectedApps: Application[]) => xorby(selectedApps, [app], "bundleId"));
  };

  const handleOnCreateOrEditPresetName = (name: string, icon: string, color: string) => {
    props.onCreateOrEditPreset({
      ...props.preset,
      name,
      icon,
      color,
      apps: selectedApps,
      urls: selectedURLs,
      new: !props.editing,
    });

    pop();
  };

  const appIsSelected = (app: Application) => {
    return selectedApps.map((selectedApp: Application) => selectedApp.bundleId).includes(app.bundleId);
  };

  const maybeContinue = () => {
    if (selectedApps.length || selectedURLs.length) {
      push(
        <CreateOrEditPresetName
          name={props.preset?.name}
          icon={props.preset?.icon}
          color={props.preset?.color}
          draftValues={!props.editing ? props.draftValues : undefined}
          editing={props.editing}
          onCreateOrEditPresetName={handleOnCreateOrEditPresetName}
        />
      );
    } else {
      showToast({ title: "At least 1 Application or URL Set required", style: Toast.Style.Failure });
    }
  };

  const ConfigureURLSet = (props: { urls: string[]; draftValues?: PresetsDraftValues; editing?: boolean }) => {
    const [urls, setUrls] = useState<string[]>([]);

    useEffect(() => {
      (async () => {
        const isEditing = Boolean(props.editing);

        if (!isEditing && props.draftValues) {
          const urlKeyPrefix = "url-";
          const indices = Object.keys(props.draftValues)
            .filter((key) => key.startsWith(urlKeyPrefix))
            .map((key) => Number(key.slice(urlKeyPrefix.length)))
            .filter((n) => Number.isFinite(n) && n >= 0)
            .sort((a, b) => a - b);

          if (indices.length) {
            const maxIndex = indices[indices.length - 1];
            const fromDraft = Array.from({ length: maxIndex + 1 }, (_, i) => {
              const key = `${urlKeyPrefix}${i}`;
              const value = props.draftValues?.[key];
              return typeof value === "string" ? value : "";
            });

            setUrls(fromDraft.length ? fromDraft : [""]);
            return;
          }
        }

        if (props.urls && props.urls.length) {
          setUrls(props.urls);
        } else {
          setUrls([""]);
        }
      })();
    }, []);

    const validateURLSet = (values: Record<string, unknown>) => {
      const urls = Object.values(values).filter((url): url is string => typeof url === "string" && url !== "");

      try {
        urls.forEach((url) => {
          new URL(url);
        });

        setSelectedURLs(urls);
        pop();
      } catch (e) {
        showToast({
          title: "One or more URLs are invalid. Please check.",
          style: Toast.Style.Failure,
        });
      }
    };

    return (
      <Form
        enableDrafts={!props.editing}
        actions={
          <ActionPanel>
            <Action.SubmitForm title="Save URL Set" icon={Icon.SaveDocument} onSubmit={validateURLSet} />
            <ActionPanel.Section title="URLs">
              <Action
                title="Add URL"
                icon={Icon.Plus}
                shortcut={{ modifiers: ["cmd"], key: "n" }}
                onAction={() => setUrls((urls: string[]) => [...urls, ""])}
              />
            </ActionPanel.Section>
          </ActionPanel>
        }
      >
        {urls.map((url: string, urlIndex: number) => (
          <Form.TextField key={urlIndex} id={`url-${urlIndex}`} title={`URL: #${urlIndex + 1}`} defaultValue={url} />
        ))}
      </Form>
    );
  };

  const ListItem = (app: Application) => {
    return (
      <List.Item
        key={app.bundleId}
        title={app.name}
        icon={{ fileIcon: app.path }}
        accessories={[{ icon: appIsSelected(app) ? Icon.Checkmark : undefined }]}
        actions={
          <ActionPanel>
            <Action
              title={`${appIsSelected(app) ? "Deselect" : "Select"} Application`}
              icon={appIsSelected(app) ? Icon.Circle : Icon.CircleProgress100}
              onAction={() => toggleApp(app)}
            />
            <Action
              title="Continue..."
              icon={Icon.ArrowRightCircleFilled}
              onAction={() => {
                clearSearchBar();
                maybeContinue();
              }}
            />
          </ActionPanel>
        }
      />
    );
  };

  return (
    <List isLoading={!hasSetApps} navigationTitle="Create Preset: (1/2)">
      <List.Section title="Special">
        <List.Item
          title={`URL Set ${selectedURLs.length ? `(${selectedURLs.length} URLs)` : ""}`}
          icon={Icon.Link}
          accessories={[{ icon: selectedURLs.length ? Icon.Checkmark : undefined }]}
          actions={
            <ActionPanel>
              <Action.Push
                title="Configure URL Set"
                icon={Icon.Cog}
                target={
                  <ConfigureURLSet
                    urls={selectedURLs}
                    draftValues={!props.editing ? props.draftValues : undefined}
                    editing={props.editing}
                  />
                }
              />
              <Action
                title="Continue..."
                icon={Icon.ArrowRightCircleFilled}
                onAction={() => {
                  clearSearchBar();
                  maybeContinue();
                }}
              />
            </ActionPanel>
          }
        />
      </List.Section>
      <List.Section title="Selected Applications">{selectedApps.map((app: Application) => ListItem(app))}</List.Section>
      <List.Section title="All Applications">
        {apps
          .filter(
            (app: Application) =>
              !selectedApps.map((selectedApp: Application) => selectedApp.bundleId).includes(app.bundleId)
          )
          .map((app: Application) => ListItem(app))}
      </List.Section>
    </List>
  );
};

export default function Command(props: LaunchProps<{ draftValues: PresetsDraftValues }>) {
  const [appPresets, setAppPresets] = useState<Preset[]>([]);
  const [hasLoadedPresets, setHasLoadedPresets] = useState(false);

  const [isShowingDetail, setIsShowingDetail] = useState(false);

  const { pop } = useNavigation();

  useEffect(() => {
    (async () => {
      const maybeAppPresets = await LocalStorage.getItem("xecutor");

      if (maybeAppPresets) {
        try {
          const appPresets = JSON.parse(maybeAppPresets as string);
          setAppPresets(appPresets);
        } catch (e) {
          // noop
        }
      }

      setHasLoadedPresets(true);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      await LocalStorage.setItem("xecutor", JSON.stringify(appPresets));
    })();
  }, [appPresets]);

  const executePreset = async (preset: Preset) => {
    await Promise.all([
      ...preset.apps.map(async (app: Application) => open(app.path)),
      ...preset.urls.map(async (url: string) => open(url)),
    ]);
  };

  const handleOnCreateOrEditPreset = (preset: Preset) => {
    if (preset.new) {
      setAppPresets((appPresets: Preset[]) =>
        [
          ...appPresets,
          {
            id: uuid(),
            name: preset.name,
            icon: preset.icon,
            color: preset.color,
            apps: preset.apps,
            urls: preset.urls,
          },
        ].sort((a: Preset, b: Preset) => a.name.toLowerCase().localeCompare(b.name.toLocaleLowerCase()))
      );
    } else {
      setAppPresets((appPresets: Preset[]) =>
        appPresets
          .map((appPreset: Preset) => {
            return appPreset.id === preset.id
              ? {
                  id: preset.id,
                  name: preset.name,
                  icon: preset.icon,
                  color: preset.color,
                  apps: preset.apps,
                  urls: preset.urls,
                }
              : appPreset;
          })
          .sort((a: Preset, b: Preset) => a.name.toLowerCase().localeCompare(b.name.toLocaleLowerCase()))
      );
    }

    pop();
  };

  const handleOnDeletePreset = async (preset: Preset) => {
    await confirmAlert({
      title: "Are you sure?",
      message: "This action is irreversible",
      icon: { source: Icon.Trash, tintColor: Color.Red },
      primaryAction: {
        title: "Delete",
        onAction: () => {
          setAppPresets((appPresets: Preset[]) =>
            appPresets.filter((appPreset: Preset) => {
              return appPreset.id !== preset.id;
            })
          );
          showToast({
            title: `Deleted preset: ${preset.name}`,
          });
        },
      },
    });
  };

  const countPluralizer = (items: Application[] | string[], singular: string, plural: string) => {
    return items.length === 1 ? `${singular}` : `${plural}`;
  };

  return (
    <List
      isLoading={!hasLoadedPresets}
      isShowingDetail={isShowingDetail}
      actions={
        <ActionPanel>
          <Action.Push
            title="Create Preset"
            icon={Icon.NewDocument}
            target={<CreateOrEditPreset onCreateOrEditPreset={handleOnCreateOrEditPreset} draftValues={props.draftValues} />}
            onPush={clearSearchBar}
          />
        </ActionPanel>
      }
    >
      {appPresets.map((preset: Preset) => (
        <List.Item
          key={preset.id}
          title={preset.name}
          icon={{ source: StringIndexableIcon[preset.icon], tintColor: StringIndexableColor[preset.color] }}
          accessories={[
            { icon: Icon.Link, text: `x${preset.urls.length}` },
            { icon: Icon.Window, text: `x${preset.apps.length}` },
          ]}
          detail={
            <List.Item.Detail
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label title="URLs" />
                  {preset.urls.length ? (
                    preset.urls.map((url: string, urlIndex: number) => (
                      <List.Item.Detail.Metadata.Link key={urlIndex} text={""} target={url} title={url} />
                    ))
                  ) : (
                    <List.Item.Detail.Metadata.Label title="None" />
                  )}
                  <List.Item.Detail.Metadata.Separator />
                  <List.Item.Detail.Metadata.Label title="Applications" />
                  {preset.apps.length ? (
                    preset.apps.map((app: Application, appIndex: number) => (
                      <List.Item.Detail.Metadata.Label key={appIndex} title={app.name} icon={{ fileIcon: app.path }} />
                    ))
                  ) : (
                    <List.Item.Detail.Metadata.Label title="None" />
                  )}
                </List.Item.Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel>
              <Action
                title="Execute Preset"
                icon={Icon.Play}
                onAction={() => {
                  executePreset(preset);
                  showHUD(
                    `${preset.apps.length} ${countPluralizer(preset.apps, "App", "Apps")}, ${
                      preset.urls.length
                    } ${countPluralizer(preset.apps, "URL", "URLs")} Launched via Preset: ${preset.name}`
                  );
                }}
              />
              <Action.Push
                title="Edit Preset"
                icon={Icon.Pencil}
                target={
                  <CreateOrEditPreset
                    preset={preset}
                    editing={true}
                    onCreateOrEditPreset={handleOnCreateOrEditPreset}
                  />
                }
              />
              <Action
                title="Toggle Details"
                icon={Icon.AppWindowSidebarRight}
                shortcut={{ modifiers: ["cmd"], key: "d" }}
                onAction={() => setIsShowingDetail(!isShowingDetail)}
              />
              <Action.Push
                title="Create Preset"
                icon={Icon.NewDocument}
                shortcut={{ modifiers: ["cmd"], key: "n" }}
                target={<CreateOrEditPreset onCreateOrEditPreset={handleOnCreateOrEditPreset} draftValues={props.draftValues} />}
                onPush={clearSearchBar}
              />
              <Action
                title="Delete Preset"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                onAction={() => handleOnDeletePreset(preset)}
              />
            </ActionPanel>
          }
        />
      ))}
      <List.EmptyView title="No Presets" />
    </List>
  );
}
