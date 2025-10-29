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