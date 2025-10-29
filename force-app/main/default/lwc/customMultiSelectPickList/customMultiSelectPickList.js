import { LightningElement, api, wire, track } from 'lwc';
import executeDynamicQuery from '@salesforce/apex/LightningUtils.executeDynamicQuery';

export default class CustomMultiSelectPickList extends LightningElement {
    // Public API properties for query-based data fetching
    @api query; // SOQL query string from parent
    @api groupBy; // Field API name to group by
    @api pickValues; // Field API name for display values
    
    // Private properties
    _preSelectedRecords = [];
    @track processedData = [];
    @track selectedItems = [];
    @track selectedGroupsData = [];
    tempSelectedItems = []; // For tracking items selected in available list
    tempChosenItems = []; // For tracking items selected in chosen list
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
            this.isLoading = true;
        }
    }

    // Process query results into grouped structure
    processQueryResults(data) {
        if (!data || !Array.isArray(data)) {
            this.processedData = [];
            return;
        }

        const groupMap = new Map();
        
        // Process each record
        data.forEach(record => {
            const groupName = this.groupBy ? (record[this.groupBy] || 'Unassigned') : 'Default Group';
            const displayValue = this.pickValues ? record[this.pickValues] : record.Name || record.Id;
            const recordId = record.Id;
            
            if (!recordId) return;
            
            if (!groupMap.has(groupName)) {
                groupMap.set(groupName, []);
            }
            
            groupMap.get(groupName).push({
                name: displayValue,
                id: recordId,
                isSelected: false
            });
        });
        
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
    }

    // Getter/Setter for selected records from parent
    @api
    get selectedRecords() {
        return this._preSelectedRecords;
    }

    set selectedRecords(value) {
        this._preSelectedRecords = value || [];
        if (this.processedData.length > 0 && this._preSelectedRecords.length > 0) {
            this.restoreSelection();
        }
    }

    // Restore selection from parent data
    restoreSelection() {
        if (!this._preSelectedRecords || this._preSelectedRecords.length === 0) {
            return;
        }

        const selectedIds = new Set(this._preSelectedRecords.map(record => record.id));
        this.selectedItems = this._preSelectedRecords.map(record => ({
            name: record.name,
            id: record.id
        }));

        const updatedData = [];
        this.processedData.forEach(group => {
            const updatedItems = group.items.map(item => ({
                ...item,
                isSelected: selectedIds.has(item.id)
            }));

            const allSelected = updatedItems.length > 0 && 
                                updatedItems.every(item => item.isSelected);

            updatedData.push({
                ...group,
                items: updatedItems,
                isAllSelected: allSelected
            });
        });
        
        this.processedData = updatedData;
        this.updateSelectedGroupsData();
    }

    // Update the selected groups data structure
    updateSelectedGroupsData() {
        const groupsMap = new Map();
        
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

    // Computed properties
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
        return this.tempSelectedItems.length === 0;
    }

    get isMoveLeftDisabled() {
        return this.tempChosenItems.length === 0;
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

    // Handle group checkbox selection - EXACTLY FROM YOUR ORIGINAL
    handleGroupSelect(event) {
        event.stopPropagation();
        const groupName = event.target.dataset.group;
        const isChecked = event.target.checked;
        
        const updatedData = [];
        this.processedData.forEach(group => {
            if (group.groupName === groupName) {
                const updatedItems = group.items.map(item => ({
                    ...item,
                    isSelected: isChecked
                }));
                
                // Update selected items array
                if (isChecked) {
                    // Add all items from this group
                    const itemsToAdd = updatedItems
                        .filter(item => !this.selectedItems.some(si => si.id === item.id))
                        .map(item => ({ name: item.name, id: item.id }));
                    this.selectedItems = [...this.selectedItems, ...itemsToAdd];
                } else {
                    // Remove all items from this group
                    const itemsToRemove = updatedItems.map(item => item.id);
                    this.selectedItems = this.selectedItems.filter(
                        item => !itemsToRemove.includes(item.id)
                    );
                }
                
                updatedData.push({
                    ...group,
                    items: updatedItems,
                    isAllSelected: isChecked
                });
            } else {
                updatedData.push(group);
            }
        });
        
        this.processedData = updatedData;
        this.updateSelectedGroupsData();
        this.emitSelectionEvent();
    }

    // Handle individual item selection - EXACTLY FROM YOUR ORIGINAL
    handleItemSelect(event) {
        event.stopPropagation();
        const itemId = event.target.dataset.itemId;
        const isChecked = event.target.checked;
        
        if (isChecked) {
            if (!this.tempSelectedItems.includes(itemId)) {
                this.tempSelectedItems = [...this.tempSelectedItems, itemId];
            }
        } else {
            this.tempSelectedItems = this.tempSelectedItems.filter(id => id !== itemId);
        }
    }

    // Move selected items from available to chosen - EXACTLY FROM YOUR ORIGINAL
    moveSelectedToChosen() {
        if (this.tempSelectedItems.length === 0) return;
        
        // Build a map of id -> item from processed data
        const idToItem = new Map();
        this.processedData.forEach(group => {
            group.items.forEach(item => {
                idToItem.set(item.id, item);
            });
        });
        
        // Add temp selected items to chosen list
        const existingIds = new Set(this.selectedItems.map(i => i.id));
        const itemsToAdd = this.tempSelectedItems
            .map(id => idToItem.get(id))
            .filter(i => i && !existingIds.has(i.id))
            .map(i => ({ name: i.name, id: i.id }));
        
        this.selectedItems = [...this.selectedItems, ...itemsToAdd];
        
        // Update processed data to mark these items as selected
        const updatedData = [];
        this.processedData.forEach(group => {
            const updatedItems = group.items.map(item => {
                if (this.tempSelectedItems.includes(item.id)) {
                    return { ...item, isSelected: true };
                }
                return item;
            });
            
            // Check if all items in group are now selected
            const allSelected = updatedItems.every(item => item.isSelected);
            updatedData.push({
                ...group,
                items: updatedItems,
                isAllSelected: allSelected
            });
        });
        
        this.processedData = updatedData;
        
        // Clear temp selection
        this.tempSelectedItems = [];
        this.updateSelectedGroupsData();
        this.emitSelectionEvent();
    }

    // Move selected items from chosen to available - EXACTLY FROM YOUR ORIGINAL
    moveChosenToAvailable() {
        if (this.tempChosenItems.length === 0) return;
        
        // Remove temp chosen items from selected list
        this.selectedItems = this.selectedItems.filter(
            item => !this.tempChosenItems.includes(item.id)
        );
        
        // Update processed data to mark these items as unselected
        const updatedData = [];
        this.processedData.forEach(group => {
            const updatedItems = group.items.map(item => {
                if (this.tempChosenItems.includes(item.id)) {
                    return { ...item, isSelected: false };
                }
                return item;
            });
            
            // Update group selection status
            const allSelected = updatedItems.every(item => item.isSelected);
            updatedData.push({
                ...group,
                items: updatedItems,
                isAllSelected: allSelected
            });
        });
        
        this.processedData = updatedData;
        
        // Clear temp selection
        this.tempChosenItems = [];
        this.updateSelectedGroupsData();
        this.emitSelectionEvent();
    }

    selectChosenItem(event) {
        const itemId = event.currentTarget.dataset.itemId;
        
        if (this.tempChosenItems.includes(itemId)) {
            this.tempChosenItems = this.tempChosenItems.filter(id => id !== itemId);
            event.currentTarget.classList.remove('selected');
        } else {
            this.tempChosenItems = [...this.tempChosenItems, itemId];
            event.currentTarget.classList.add('selected');
        }
    }

    removeItem(event) {
        event.stopPropagation();
        const itemIdToRemove = event.target.dataset.itemId;
        
        this.selectedItems = this.selectedItems.filter(item => item.id !== itemIdToRemove);
        
        const updatedData = [];
        this.processedData.forEach(group => {
            const updatedItems = group.items.map(item => {
                if (item.id === itemIdToRemove) {
                    return { ...item, isSelected: false };
                }
                return item;
            });
            
            const allSelected = updatedItems.every(item => item.isSelected);
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
            },
            bubbles: true,
            composed: true
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
        this.tempSelectedItems = [];
        this.tempChosenItems = [];
        this._preSelectedRecords = [];
        
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
