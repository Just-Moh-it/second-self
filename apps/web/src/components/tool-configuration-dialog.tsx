import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toolTemplates } from '@/lib/tool-templates';
import { BackendTag } from './backend-tag';

type ToolConfigurationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingIndex: number | null;
  selectedTemplate: string;
  editingSchemaStr: string;
  isJsonValid: boolean;
  onTemplateChange: (val: string) => void;
  onSchemaChange: (val: string) => void;
  onSave: () => void;
  backendTools: unknown[]; // schemas returned from the server
};

export const ToolConfigurationDialog = ({
  open,
  onOpenChange,
  editingIndex,
  selectedTemplate,
  editingSchemaStr,
  isJsonValid,
  onTemplateChange,
  onSchemaChange,
  onSave,
  backendTools,
}: ToolConfigurationDialogProps) => {
  // Combine local templates and backend templates
  const localTemplateOptions = toolTemplates.map((template) => ({
    ...template,
    source: 'local',
  }));

  const backendTemplateOptions = backendTools.map((t: any) => ({
    ...t,
    source: 'backend',
  }));

  const allTemplates = [...localTemplateOptions, ...backendTemplateOptions];

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingIndex === null ? 'Add Tool' : 'Edit Tool'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Select onValueChange={onTemplateChange} value={selectedTemplate}>
            <SelectTrigger>
              <SelectValue placeholder="Select a template (optional)" />
            </SelectTrigger>
            <SelectContent>
              {allTemplates.map((template) => (
                <SelectItem key={template.name} value={template.name}>
                  <span className="flex items-center">
                    {template.name}
                    {template.source === 'backend' && <BackendTag />}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea
            className="min-h-[200px] font-mono text-sm"
            onChange={(e) => onSchemaChange(e.target.value)}
            placeholder="Enter tool JSON schema"
            value={editingSchemaStr}
          />
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button disabled={!isJsonValid} onClick={onSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
