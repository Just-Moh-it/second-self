/** biome-ignore-all lint/style/noNestedTernary: <explanation> */
import { AlertCircle, Check, Edit, Plus, Trash } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toolTemplates } from '@/lib/tool-templates';
import { useBackendTools } from '@/lib/use-backend-tools';
import { BackendTag } from './backend-tag';
import { ToolConfigurationDialog } from './tool-configuration-dialog';

type SessionConfigurationPanelProps = {
  callStatus: string;
  sessionId?: string;
  onSave: (config: unknown) => void;
  initialConfig?: {
    instructions: string;
    voice: string;
    tools: string[];
  };
};

const SAVE_STATUS_RESET_DELAY = 3000;

const BACKEND_TOOLS_REFRESH_INTERVAL = 3000;

const SessionConfigurationPanel: React.FC<SessionConfigurationPanelProps> = ({
  callStatus,
  sessionId,
  onSave,
  initialConfig,
}) => {
  const [instructions, setInstructions] = useState(
    initialConfig?.instructions ||
      'You are a helpful assistant in a phone call.'
  );
  const [voice, setVoice] = useState(initialConfig?.voice || 'ash');
  const [tools, setTools] = useState<string[]>(initialConfig?.tools || []);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingSchemaStr, setEditingSchemaStr] = useState('');
  const [isJsonValid, setIsJsonValid] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // Custom hook to fetch backend tools every 3 seconds
  const backendTools = useBackendTools(
    'http://localhost:8081/tools',
    BACKEND_TOOLS_REFRESH_INTERVAL
  );

  // Track changes to determine if there are unsaved modifications
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [instructions, voice, tools]);

  // Reset save status after a delay when saved
  useEffect(() => {
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => {
        setSaveStatus('idle');
      }, SAVE_STATUS_RESET_DELAY);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await onSave({
        instructions,
        voice,
        tools: tools.map((tool) => JSON.parse(tool)),
      });
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
    } catch (error) {
      setSaveStatus('error');
    }
  };

  const handleAddTool = () => {
    setEditingIndex(null);
    setEditingSchemaStr('');
    setSelectedTemplate('');
    setIsJsonValid(true);
    setOpenDialog(true);
  };

  const handleEditTool = (index: number) => {
    setEditingIndex(index);
    setEditingSchemaStr(tools[index] || '');
    setSelectedTemplate('');
    setIsJsonValid(true);
    setOpenDialog(true);
  };

  const handleDeleteTool = (index: number) => {
    const newTools = [...tools];
    newTools.splice(index, 1);
    setTools(newTools);
  };

  const handleDialogSave = () => {
    try {
      JSON.parse(editingSchemaStr);
    } catch {
      return;
    }
    const newTools = [...tools];
    if (editingIndex === null) {
      newTools.push(editingSchemaStr);
    } else {
      newTools[editingIndex] = editingSchemaStr;
    }
    setTools(newTools);
    setOpenDialog(false);
  };

  const handleTemplateChange = (val: string) => {
    setSelectedTemplate(val);

    // Determine if the selected template is from local or backend
    const templateObj =
      toolTemplates.find((t) => t.name === val) ||
      backendTools.find((t: any) => t.name === val);

    if (templateObj) {
      setEditingSchemaStr(JSON.stringify(templateObj, null, 2));
      setIsJsonValid(true);
    }
  };

  const onSchemaChange = (value: string) => {
    setEditingSchemaStr(value);
    try {
      JSON.parse(value);
      setIsJsonValid(true);
    } catch {
      setIsJsonValid(false);
    }
  };

  const getToolNameFromSchema = (schema: string): string => {
    try {
      const parsed = JSON.parse(schema);
      return parsed?.name || 'Untitled Tool';
    } catch {
      return 'Invalid JSON';
    }
  };

  const isBackendTool = (name: string): boolean => {
    return backendTools.some((t: any) => t.name === name);
  };

  return (
    <Card className="mx-auto flex h-full w-full flex-col">
      <CardHeader className="px-4 pb-0 sm:px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="font-semibold text-base">
            Session Configuration
          </CardTitle>
          <div className="flex items-center gap-2">
            {saveStatus === 'error' ? (
              <span className="flex items-center gap-1 text-destructive text-xs">
                <AlertCircle className="h-3 w-3" />
                Save failed
              </span>
            ) : hasUnsavedChanges ? (
              <span className="text-muted-foreground text-xs">Not saved</span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-3 sm:p-5">
        <ScrollArea className="h-full">
          <div className="m-1 space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <label
                className="font-medium text-sm leading-none"
                htmlFor="instructions"
              >
                Instructions
              </label>
              <Textarea
                className="max-h-[200px] min-h-[100px] resize-none"
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Enter instructions"
                value={instructions}
              />
            </div>

            <div className="space-y-2">
              <label
                className="font-medium text-sm leading-none"
                htmlFor="voice"
              >
                Voice
              </label>
              <Select onValueChange={setVoice} value={voice}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  {['ash', 'ballad', 'coral', 'sage', 'verse'].map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label
                className="font-medium text-sm leading-none"
                htmlFor="tools"
              >
                Tools
              </label>
              <div className="space-y-2">
                {tools.map((tool, index) => {
                  const name = getToolNameFromSchema(tool);
                  const backend = isBackendTool(name);
                  return (
                    <div
                      className="flex items-center justify-between gap-2 rounded-md border p-2 sm:p-3"
                      key={name}
                    >
                      <span className="flex min-w-0 flex-1 items-center truncate text-sm">
                        {name}
                        {backend && <BackendTag />}
                      </span>
                      <div className="flex flex-shrink-0 gap-1">
                        <Button
                          className="h-8 w-8"
                          onClick={() => handleEditTool(index)}
                          size="icon"
                          variant="ghost"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          className="h-8 w-8"
                          onClick={() => handleDeleteTool(index)}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Button
                  className="w-full"
                  onClick={handleAddTool}
                  variant="outline"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Tool
                </Button>
              </div>
            </div>

            <Button
              className="mt-4 w-full"
              disabled={saveStatus === 'saving' || !hasUnsavedChanges}
              onClick={handleSave}
            >
              {saveStatus === 'saving' ? (
                'Saving...'
              ) : saveStatus === 'saved' ? (
                <span className="flex items-center">
                  Saved Successfully
                  <Check className="ml-2 h-4 w-4" />
                </span>
              ) : saveStatus === 'error' ? (
                'Error Saving'
              ) : (
                'Save Configuration'
              )}
            </Button>
          </div>
        </ScrollArea>
      </CardContent>

      <ToolConfigurationDialog
        backendTools={backendTools}
        editingIndex={editingIndex}
        editingSchemaStr={editingSchemaStr}
        isJsonValid={isJsonValid}
        onOpenChange={setOpenDialog}
        onSave={handleDialogSave}
        onSchemaChange={onSchemaChange}
        onTemplateChange={handleTemplateChange}
        open={openDialog}
        selectedTemplate={selectedTemplate}
      />
    </Card>
  );
};

export default SessionConfigurationPanel;
