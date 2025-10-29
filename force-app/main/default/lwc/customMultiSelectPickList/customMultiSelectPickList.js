// CustomMultiSelectPickList.js
import { LightningElement, api, wire, track } from 'lwc';
import executeDynamicQuery from '@salesforce/apex/LightningUtils.executeDynamicQuery';

export default class CustomMultiSelectPickList extends LightningElement {
    // Public API properties
    @api query; // SOQL query string from parent
    @api groupBy; // Field API name to group by
    @api pickValues; // Field API name for display values
    
    // Private properties - using @track for complex objects
    _preSelectedRecords = [];
    @track processedData = [];
    @track selectedItems = [];
    @track selectedGroupsData = [];
    isLoading = true;
    error = null;

    // Wire adapter to execute the query
    @wire(executeDynamicQuery, { query: '$query' })
    wiredData({ error, data }) {

        
        if (data) {
            this.isLoading = false;
            this.error = null;
            this.processQueryResults(data);
            
            // Restore selection if we have pre-selected records
            if (this._preSelectedRecords.length > 0) {
                this.restoreSelection();
            }
        } else if (error) {
            this.isLoading = false;
            this.error = error;
            console.error('Error loading data:', error);
            this.processedData = [];
        } else {
            // Still loading
            this.isLoading = true;
        }
    }

    // Process query results into grouped structure
    processQueryResults(data) {
        console.log('Processing query results:', data);
        
        if (!data || !Array.isArray(data)) {
            console.log('No data or data is not an array');
            this.processedData = [];
            return;
        }

        const groupMap = new Map();
        
        // Process each record
        data.forEach(record => {
            // Get group name, defaulting to 'Unassigned' if null/undefined
            const groupName = this.groupBy ? (record[this.groupBy] || 'Unassigned') : 'Default Group';
            
            // Get display value and ID
            const displayValue = this.pickValues ? record[this.pickValues] : record.Name || record.Id;
            const recordId = record.Id;
            
            console.log('Processing record:', { groupName, displayValue, recordId });
            
            // Skip if no ID
            if (!recordId) {
                console.log('Skipping record with no ID');
                return;
            }
            
            // Initialize group array if it doesn't exist
            if (!groupMap.has(groupName)) {
                groupMap.set(groupName, []);
            }
            
            // Add item to the group
            groupMap.get(groupName).push({
                name: displayValue,
                id: recordId,
                isSelected: false
            });
        });
        
        console.log('Group map created:', groupMap);
        
        // Convert Map to array format for rendering
        const tempData = [];
        groupMap.forEach((items, groupName) => {
            tempData.push({
                groupName: groupName,
                items: items,
                isExpanded: false,
                isAllSelected: false,
                toggleIcon: '▼',
                itemsClass: 'items-list collapsed'
            });
        });
        
        this.processedData = tempData;
        console.log('Final processed data:', this.processedData);
    }

    // Getter/Setter for selected records from parent
    @api
    get selectedRecords() {
        return this._preSelectedRecords;
    }

    set selectedRecords(value) {
        this._preSelectedRecords = value || [];
        // Restore selection if we have data
        if (this.processedData.length > 0 && this._preSelectedRecords.length > 0) {
            this.restoreSelection();
        }
    }

    // Restore selection from parent data
    restoreSelection() {
        if (!this._preSelectedRecords || this._preSelectedRecords.length === 0) {
            return;
        }

        // Create a Set of selected IDs for faster lookup
        const selectedIds = new Set(this._preSelectedRecords.map(record => record.id));

        // Update selectedItems with the pre-selected records
        this.selectedItems = [...this._preSelectedRecords];

        // Update processedData to reflect the selection state
        const updatedData = [];
        this.processedData.forEach(group => {
            const updatedItems = group.items.map(item => ({
                ...item,
                isSelected: selectedIds.has(item.id)
            }));

            // Check if all items in group are selected
            const allSelected = updatedItems.length > 0 && 
                                updatedItems.every(item => item.isSelected);

            updatedData.push({
                ...group,
                items: updatedItems,
                isAllSelected: allSelected
            });
        });
        
        this.processedData = updatedData;

        // Update the selected groups data structure
        this.updateSelectedGroupsData();
    }

    // Update the selected groups data structure
    updateSelectedGroupsData() {
        const groupsMap = new Map();
        
        // Group selected items by their groups
        this.processedData.forEach(group => {
            const selectedInGroup = group.items.filter(item => 
                this.selectedItems.some(si => si.id === item.id)
            );
            
            if (selectedInGroup.length > 0) {
                groupsMap.set(group.groupName, {
                    groupName: group.groupName,
                    items: selectedInGroup.map(i => ({ name: i.name, id: i.id })),
                    isExpanded: true,
                    toggleIcon: '▲',
                    itemsClass: 'items-list expanded'
                });
            }
        });
        
        const tempSelectedGroups = [];
        groupsMap.forEach((value) => {
            tempSelectedGroups.push(value);
        });
        
        this.selectedGroupsData = tempSelectedGroups;
    }

    // Computed properties for template
    get hasSelectedItems() {
        return this.selectedItems.length > 0;
    }

    get selectedItemsDisplay() {
        return this.selectedGroupsData;
    }

    get availableCount() {
        let count = 0;
        this.processedData.forEach(group => {
            count += group.items.filter(item => !item.isSelected).length;
        });
        return count;
    }

    get selectedCount() {
        return this.selectedItems.length;
    }

    get isMoveRightDisabled() {
        // Check if any checkbox in available list is checked
        const checkboxes = this.template.querySelectorAll('.listbox-section:first-child .item-checkbox:checked');
        return checkboxes.length === 0;
    }

    get isMoveLeftDisabled() {
        // Check if any item in selected list is highlighted
        const selectedRows = this.template.querySelectorAll('.selected-item-row.selected');
        return selectedRows.length === 0;
    }

    // Event handlers
    stopPropagation(event) {
        event.stopPropagation();
    }

    toggleGroup(event) {
        const groupName = event.currentTarget.dataset.group;
        const updatedData = [];
        
        this.processedData.forEach(group => {
            if (group.groupName === groupName) {
                const isExpanded = !group.isExpanded;
                updatedData.push({
                    ...group,
                    isExpanded: isExpanded,
                    toggleIcon: isExpanded ? '▲' : '▼',
                    itemsClass: isExpanded ? 'items-list expanded' : 'items-list collapsed'
                });
            } else {
                updatedData.push(group);
            }
        });
        
        this.processedData = updatedData;
    }

    toggleSelectedGroup(event) {
        const groupName = event.currentTarget.dataset.group;
        const updatedGroups = [];
        
        this.selectedGroupsData.forEach(group => {
            if (group.groupName === groupName) {
                const isExpanded = !group.isExpanded;
                updatedGroups.push({
                    ...group,
                    isExpanded: isExpanded,
                    toggleIcon: isExpanded ? '▲' : '▼',
                    itemsClass: isExpanded ? 'items-list expanded' : 'items-list collapsed'
                });
            } else {
                updatedGroups.push(group);
            }
        });
        
        this.selectedGroupsData = updatedGroups;
    }

    handleGroupSelect(event) {
        event.stopPropagation();
        const groupName = event.target.dataset.group;
        const isChecked = event.target.checked;
        
        const updatedData = [];
        this.processedData.forEach(group => {
            if (group.groupName === groupName) {
                // Update all checkboxes in the group
                const checkboxes = this.template.querySelectorAll(
                    `.group-item[data-group="${groupName}"] .item-checkbox`
                );
                checkboxes.forEach(cb => cb.checked = isChecked);
                
                updatedData.push({
                    ...group,
                    isAllSelected: isChecked
                });
            } else {
                updatedData.push(group);
            }
        });
        
        this.processedData = updatedData;
    }

    moveSelectedToChosen() {
        // Get all checked items from available list
        const checkedBoxes = this.template.querySelectorAll('.listbox-section:first-child .item-checkbox:checked');
        if (checkedBoxes.length === 0) return;
        
        const itemsToAdd = [];
        const existingIds = new Set(this.selectedItems.map(i => i.id));
        
        checkedBoxes.forEach(checkbox => {
            const itemId = checkbox.dataset.itemId;
            const itemName = checkbox.dataset.itemName;
            
            if (!existingIds.has(itemId)) {
                itemsToAdd.push({ name: itemName, id: itemId });
            }
            
            // Uncheck the checkbox
            checkbox.checked = false;
        });
        
        this.selectedItems = [...this.selectedItems, ...itemsToAdd];
        
        // Update processed data
        const updatedData = [];
        this.processedData.forEach(group => {
            const updatedItems = group.items.map(item => {
                if (itemsToAdd.some(added => added.id === item.id)) {
                    return { ...item, isSelected: true };
                }
                return item;
            });
            
            const allSelected = updatedItems.every(item => item.isSelected);
            
            // Update group checkbox
            const groupCheckbox = this.template.querySelector(`.group-checkbox[data-group="${group.groupName}"]`);
            if (groupCheckbox) {
                groupCheckbox.checked = allSelected;
            }
            
            updatedData.push({
                ...group,
                items: updatedItems,
                isAllSelected: allSelected
            });
        });
        
        this.processedData = updatedData;
        this.updateSelectedGroupsData();
        this.emitSelectionEvent();
    }

    moveChosenToAvailable() {
        // Get all selected items from chosen list
        const selectedRows = this.template.querySelectorAll('.selected-item-row.selected');
        if (selectedRows.length === 0) return;
        
        const itemsToRemove = [];
        selectedRows.forEach(row => {
            itemsToRemove.push(row.dataset.itemId);
            row.classList.remove('selected');
        });
        
        this.selectedItems = this.selectedItems.filter(
            item => !itemsToRemove.includes(item.id)
        );
        
        // Update processed data
        const updatedData = [];
        this.processedData.forEach(group => {
            const updatedItems = group.items.map(item => {
                if (itemsToRemove.includes(item.id)) {
                    return { ...item, isSelected: false };
                }
                return item;
            });
            
            const allSelected = updatedItems.every(item => item.isSelected);
            
            // Update group checkbox
            const groupCheckbox = this.template.querySelector(`.group-checkbox[data-group="${group.groupName}"]`);
            if (groupCheckbox) {
                groupCheckbox.checked = allSelected;
            }
            
            updatedData.push({
                ...group,
                items: updatedItems,
                isAllSelected: allSelected
            });
        });
        
        this.processedData = updatedData;
        this.updateSelectedGroupsData();
        this.emitSelectionEvent();
    }

    selectChosenItem(event) {
        const row = event.currentTarget;
        row.classList.toggle('selected');
    }

    removeItem(event) {
        event.stopPropagation();
        const itemIdToRemove = event.target.dataset.itemId;
        
        this.selectedItems = this.selectedItems.filter(item => item.id !== itemIdToRemove);
        
        // Update the processedData
        const updatedData = [];
        this.processedData.forEach(group => {
            const updatedItems = group.items.map(item => {
                if (item.id === itemIdToRemove) {
                    return { ...item, isSelected: false };
                }
                return item;
            });
            
            const allSelected = updatedItems.every(item => item.isSelected);
            
            // Update group checkbox
            const groupCheckbox = this.template.querySelector(`.group-checkbox[data-group="${group.groupName}"]`);
            if (groupCheckbox) {
                groupCheckbox.checked = allSelected;
            }
            
            updatedData.push({
                ...group,
                items: updatedItems,
                isAllSelected: allSelected
            });
        });
        
        this.processedData = updatedData;
        this.updateSelectedGroupsData();
        this.emitSelectionEvent();
    }

    removeGroup(event) {
        event.stopPropagation();
        const groupToRemove = event.target.dataset.group;
        
        // Find all items in this group and remove them
        const updatedData = [];
        this.processedData.forEach(group => {
            if (group.groupName === groupToRemove) {
                const itemsToRemove = group.items.map(i => i.id);
                this.selectedItems = this.selectedItems.filter(
                    item => !itemsToRemove.includes(item.id)
                );
                
                const updatedItems = group.items.map(item => ({
                    ...item,
                    isSelected: false
                }));
                
                // Update group checkbox
                const groupCheckbox = this.template.querySelector(`.group-checkbox[data-group="${group.groupName}"]`);
                if (groupCheckbox) {
                    groupCheckbox.checked = false;
                }
                
                updatedData.push({
                    ...group,
                    items: updatedItems,
                    isAllSelected: false
                });
            } else {
                updatedData.push(group);
            }
        });
        
        this.processedData = updatedData;
        this.updateSelectedGroupsData();
        this.emitSelectionEvent();
    }

    emitSelectionEvent() {
        const selectionEvent = new CustomEvent('selection', {
            detail: {
                selectedRecords: this.selectedItems.map(i => ({ 
                    name: i.name, 
                    id: i.id 
                }))
            }
        });
        this.dispatchEvent(selectionEvent);
    }

    // Public API methods
    @api
    getSelectedRecords() {
        return [...this.selectedItems];
    }

    @api
    resetSelections() {
        this.selectedItems = [];
        this.selectedGroupsData = [];
        this._preSelectedRecords = [];
        
        // Uncheck all checkboxes
        const allCheckboxes = this.template.querySelectorAll('.item-checkbox, .group-checkbox');
        allCheckboxes.forEach(cb => cb.checked = false);
        
        // Remove selected class from chosen items
        const selectedRows = this.template.querySelectorAll('.selected-item-row.selected');
        selectedRows.forEach(row => row.classList.remove('selected'));
        
        const updatedData = [];
        this.processedData.forEach(group => {
            updatedData.push({
                ...group,
                isAllSelected: false,
                items: group.items.map(item => ({
                    ...item,
                    isSelected: false
                }))
            });
        });
        
        this.processedData = updatedData;
        this.emitSelectionEvent();
    }

    @api
    setSelectedRecords(records) {
        this._preSelectedRecords = records || [];
        if (this.processedData.length > 0) {
            this.restoreSelection();
        }
    }
}