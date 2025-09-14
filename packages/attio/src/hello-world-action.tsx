import type { BulkRecordAction } from "attio/client";
import { showDialog } from "attio/client";

import { HelloWorldDialog } from "./hello-world-dialog";

export const bulkRecordAction: BulkRecordAction = {
	id: "run-agent",
	label: "Send to agent",
	onTrigger: async () => {
		showDialog({
			title: "Send to agent",
			Dialog: () => {
				return <HelloWorldDialog />;
			},
		});
	},
};
