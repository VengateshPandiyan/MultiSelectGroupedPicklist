# CustomMultiSelectPickList Component

## Overview
A reusable Lightning Web Component that creates a dual-listbox interface for selecting multiple records from any Salesforce object. The component automatically fetches data via SOQL, groups records by a specified field, and provides an intuitive selection interface.

<img width="999" height="607" alt="Image" src="https://github.com/user-attachments/assets/1717b1bf-f11d-4274-b9f0-c681ddee9aa2" />

## Features
- Automatic data fetching via SOQL query
- Groups records by any field
- Dual-listbox interface (Available → Selected)
- Bulk selection of entire groups
- Collapsible group sections
- Real-time item counts

## Installation

### 1. Create Apex Controller
Create a class named `LightningUtils.cls`:

```apex
public with sharing class LightningUtils {
    @AuraEnabled
    public static List<SObject> executeDynamicQuery(String query) {
        try {
            return Database.query(query);
        } catch (Exception e) {
            throw new AuraHandledException('Query failed: ' + e.getMessage());
        }
    }
}
```

### 2. Update Component Import
In `customMultiSelectPickList.js`, update the import statement:
```javascript
import executeDynamicQuery from '@salesforce/apex/LightningUtils.executeDynamicQuery';
```

## Usage

### Parent Component Example

**JavaScript (`parentComponent.js`):**
```javascript
import { LightningElement, api } from 'lwc';

export default class ParentComponent extends LightningElement {
    // Configuration
    dataQuery = 'SELECT Id, Name, Category__c FROM Product2 WHERE IsActive = true';
    groupByField = 'Region__c';
    displayField = 'Name';
    selectedRecords = [];

    // Handle selection changes
    handleSelection(event) {
        this.selectedRecords = event.detail.selectedRecords;
        console.log('Selected:', this.selectedRecords);
    }


    // Reset selections when needed
    @api
    resetComponent() {
        this.selectedRecords = [];
        const multiSelect = this.template.querySelector('c-custom-multi-select-pick-list');
        if (multiSelect) {
            multiSelect.resetSelections();
        }
    }
}
```

**Template (`parentComponent.html`):**
```html
<template>
    <lightning-card title="Select Items">
        <c-custom-multi-select-pick-list 
            query={dataQuery}
            group-by={groupByField}
            pick-values={displayField}
            selected-records={selectedRecords}
            onselection={handleSelection}>
        </c-custom-multi-select-pick-list>
    </lightning-card>
</template>
```

## Component Properties

| Property | Type | Description |
|----------|------|-------------|
| `query` | String | SOQL query to fetch records |
| `group-by` | String | Field to group records by |
| `pick-values` | String | Field to display as label |
| `selected-records` | Array | Pre-selected records |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `selection` | `{selectedRecords: [{id, name}]}` | Fired when selection changes |

## Methods

| Method | Description |
|--------|-------------|
| `getSelectedRecords()` | Returns array of selected records |
| `resetSelections()` | Clears all selections |
| `setSelectedRecords(records)` | Set selections programmatically |

## Query Requirements
Your SOQL query must include:
- `Id` field (required)
- The field specified in `group-by`
- The field specified in `pick-values`

## Example Configurations

```javascript
// Products grouped by Category
dataQuery = 'SELECT Id, Name, Category__c FROM Product2 WHERE IsActive = true';
groupByField = 'Category__c';
displayField = 'Name';

// Accounts grouped by Industry
dataQuery = 'SELECT Id, Name, Industry FROM Account WHERE Industry != null';
groupByField = 'Industry';
displayField = 'Name';

// Users grouped by Department
dataQuery = 'SELECT Id, Name, Department FROM User WHERE IsActive = true';
groupByField = 'Department';
displayField = 'Name';
```

That's it! The component handles all the complexity of data fetching, grouping, and selection management.
