// controllers/designController.js
import Design from '../models/Design.js';

// Get all designs
export async function getDesigns(req, res) {
    try {
        const designs = await Design.find();
        res.status(200).json(designs);
    } catch (error) {
        res.status(500).json({ message: "Error fetching designs", error: error });
    }
}

// Get a single design
export async function getDesign(req, res) {
    const { id } = req.params;
    try {
        const design = await Design.findById(id);
        if (!design) return res.status(404).json({ message: "Design not found" });
        res.status(200).json(design);
    } catch (error) {
        res.status(500).json({ message: "Error fetching the design", error: error });
    }
}

export const createDesign = async (req, res) => {
    try {
        const { clientId, title, description, designType, fileUrls } = req.body;
    
        // Make sure fileUrls is an array
        if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
            return res.status(400).json({
            success: false,
            message: 'No file URLs provided. Please upload images first, then pass their URLs here.'
            });
        }
    
        const newDesign = await Design.create({
            clientId,
            title,
            description,
            designType,
            fileUrls   // store the array of image paths
        });
    
        return res.status(201).json({
            success: true,
            message: 'Design created successfully',
            data: newDesign
        });
    } catch (error) {
        console.error('Error creating design:', error);
        return res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};
