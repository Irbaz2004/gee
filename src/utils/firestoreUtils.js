import { collection } from 'firebase/firestore';

/**
 * Helper to get a Firestore collection reference for the selected company.
 * 
 * @param {Firestore} db - The Firestore instance
 * @param {string} companyId - The ID of the selected company (e.g. 'galaxy', 'faizan')
 * @param {string} collectionName - The name of the collection (e.g. 'invoices', 'materials')
 * @returns {CollectionReference} - The Firestore collection reference
 */
export const getCompanyCollection = (db, companyId, collectionName) => {
    if (!companyId) {
        throw new Error('Company ID is required to fetch collection');
    }
    return collection(db, 'companies', companyId, collectionName);
};
