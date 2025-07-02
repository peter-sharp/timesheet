export default function Store(adapters) {
    async function read({ archivedTasksSearchTerm = "", archiveBrowserTaskPage = 0, archiveBrowserTaskPageSize = 20 } = {}) {
        let data = {};
        let errors = [];

        // Read from all adapters and merge the data
        for (const adapter of adapters) {
            try {
                const adapterData = await adapter.read({ archivedTasksSearchTerm, archiveBrowserTaskPage, archiveBrowserTaskPageSize });
                data = { ...data, ...adapterData };
            } catch (e) {
                console.error('Error reading from adapter:', e);
                errors.push(e);
            }
        }

        if (errors.length) {
            data.errors = errors;
        }

        return data;
    }

    async function write(data) {
        // Write to all adapters
        const results = await Promise.allSettled(
            adapters.map(adapter => adapter.write(data))
        );

        // Check for any failures
        const failures = results.filter(result => result.status === 'rejected');
        if (failures.length > 0) {
            console.error('Some storage adapters failed to write:', failures);
        }
    }

    return {
        read,
        write
    }
}
