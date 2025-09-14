# Attio Queue Operations

This package provides tools for bulk managing queue records in Attio CRM.

## Setup

1. **Get your Attio API Key**
   - Go to https://app.attio.com/
   - Navigate to Settings → API Keys
   - Create a new API key with appropriate permissions

2. **Set environment variable**
   ```bash
   export ATTIO_API_KEY='your-api-key-here'
   ```

   Or create a `.env` file in the attio package directory:
   ```bash
   ATTIO_API_KEY=your-api-key-here
   ```

## Usage

### Fetch Current Queue Records

To retrieve all existing queue records:

```bash
cd packages/attio
bun run queue:fetch
```

Or specify a custom object:
```bash
bun run scripts/manage-queue.ts -a fetch -o custom_object_slug
```

### Bulk Create Queue Records

1. Edit `sample-queue-data.json` with your records
2. Run the create command:

```bash
bun run queue:create
```

Or use a custom file:
```bash
bun run scripts/manage-queue.ts -a create -f ./my-data.json
```

### Assert (Create or Update) Records

Use assert when you want to update existing records or create new ones based on a matching attribute:

```bash
bun run queue:assert
```

This uses the `name` field as the matching attribute by default. To use a different field:
```bash
bun run scripts/manage-queue.ts -a assert -f ./my-data.json -m email
```

## Data Format

The JSON file should contain an array of objects with your queue record fields:

```json
[
  {
    "name": "Queue Item Name",
    "status": "pending",
    "priority": "high",
    "description": "Description of the task",
    "assigned_to": "team_name",
    "created_date": "2025-01-14"
  }
]
```

## API Functions

The following functions are available in `src/queue-bulk-operations.ts`:

- `fetchQueueRecords(objectSlug)` - Fetch all records from an object
- `createQueueRecord(objectSlug, recordData)` - Create a single record
- `bulkCreateQueueRecords(objectSlug, records, batchSize)` - Create multiple records
- `assertQueueRecords(objectSlug, records, matchingAttribute)` - Create or update records

## Custom Objects

If your queue is not named "queue" in Attio, you can specify the object slug:

```bash
# For an object with slug "task_queue"
bun run scripts/manage-queue.ts -a fetch -o task_queue
bun run scripts/manage-queue.ts -a create -f data.json -o task_queue
```

## Rate Limits

The bulk operations respect Attio's rate limits:
- Records are created in batches of 10 by default
- 1-second delay between batches
- Automatic retry on rate limit errors

## Troubleshooting

1. **401 Unauthorized**: Check your API key is set correctly
2. **404 Not Found**: Verify the object slug exists in your Attio workspace
3. **400 Bad Request**: Check that your data matches the object's schema
4. **Rate Limit**: The script automatically handles rate limits with delays

## Advanced Usage

### Custom Integration

```typescript
import {
  fetchQueueRecords,
  bulkCreateQueueRecords
} from '../src/queue-bulk-operations';

// In your code
async function processQueues() {
  const records = await fetchQueueRecords('my_object');
  
  const newRecords = records.map(r => ({
    ...r.values,
    status: 'processed'
  }));
  
  await bulkCreateQueueRecords('processed_queue', newRecords);
}
```

### Environment-Specific Configuration

Create different `.env` files for different environments:
- `.env.development` - Development API key
- `.env.production` - Production API key

Then load the appropriate one:
```bash
export $(cat .env.production | xargs) && bun run queue:create
```