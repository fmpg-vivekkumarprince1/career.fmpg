const Review = require("../models/review");
const User = require("../models/user");
const OfferLetter = require("../models/offerLetter");

// In-memory cache for approved reviews
const approvedReviewsCache = new Map();
const REVIEW_CACHE_TTL_MS = 60 * 1000;

const invalidateReviewCache = () => {
    approvedReviewsCache.clear();
};

// Submit a new review (for authenticated employees/offer recipients)
const submitReview = async (req, res) => {
    try {
        const { 
            rating, 
            title, 
            content, 
            department, 
            position, 
            workType, 
            employmentDuration, 
            pros, 
            cons, 
            advice, 
            isAnonymous 
        } = req.body;

        // Validate required fields
        if (!rating || !title || !content) {
            return res.status(400).json({ 
                message: "Rating, title, and content are required" 
            });
        }

        // Validate rating range
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ 
                message: "Rating must be between 1 and 5" 
            });
        }

        // Check if user has already submitted a review
        const existingReview = await Review.findOne({ userId: req.user._id });
        if (existingReview) {
            return res.status(400).json({ 
                message: "You have already submitted a review" 
            });
        }

        // Create new review
        const review = new Review({
            userId: req.user._id,
            userEmail: req.user.email,
            userName: isAnonymous ? 'Anonymous' : req.user.name,
            rating,
            title,
            content,
            department,
            position,
            workType,
            employmentDuration,
            pros,
            cons,
            advice,
            isAnonymous: isAnonymous || false,
            reviewerType: req.reviewerType,
            status: 'pending'
        });

        const savedReview = await review.save();

        res.status(201).json({
            message: "Review submitted successfully and is pending approval",
            review: {
                id: savedReview._id,
                status: savedReview.status,
                createdAt: savedReview.createdAt
            }
        });

    } catch (error) {
        console.error("Error submitting review:", error);
        res.status(500).json({ 
            message: "Failed to submit review", 
            error: error.message 
        });
    }
};

// Get all approved reviews (public endpoint - cached for performance)
const getApprovedReviews = async (req, res) => {
    try {
        const { page = 1, limit = 10, rating, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        const cacheKey = `${page}:${limit}:${rating || 'all'}:${sortBy}:${sortOrder}`;

        const cached = approvedReviewsCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < REVIEW_CACHE_TTL_MS)) {
            return res.status(200).json(cached.data);
        }

        const filter = { status: 'approved' };
        if (rating && rating !== 'all') {
            filter.rating = parseInt(rating);
        }

        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const reviews = await Review.find(filter).lean()
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-userId -userEmail -moderatorNotes -approvedBy -rejectedBy -rejectionReason');

        const total = await Review.countDocuments(filter);

        // Calculate rating statistics
        const ratingStats = await Review.aggregate([
            { $match: { status: 'approved' } },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: "$rating" },
                    totalReviews: { $sum: 1 },
                    ratingDistribution: {
                        $push: "$rating"
                    }
                }
            }
        ]);

        const stats = ratingStats[0] || { averageRating: 0, totalReviews: 0, ratingDistribution: [] };
        
        // Calculate rating distribution
        const distribution = [1, 2, 3, 4, 5].map(rating => {
            const count = stats.ratingDistribution.filter(r => r === rating).length;
            return { rating, count };
        });

        const responsePayload = {
            reviews,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            },
            stats: {
                averageRating: stats.averageRating ? parseFloat(stats.averageRating.toFixed(1)) : 0,
                totalReviews: stats.totalReviews,
                ratingDistribution: distribution
            }
        };

        approvedReviewsCache.set(cacheKey, { data: responsePayload, timestamp: Date.now() });

        res.status(200).json(responsePayload);

    } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ 
            message: "Failed to fetch reviews", 
            error: error.message 
        });
    }
};

// Get pending reviews (admin only)
const getPendingReviews = async (req, res) => {
    try {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const reviews = await Review.find({ status: 'pending' })
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('userId', 'name email');

        const total = await Review.countDocuments({ status: 'pending' });

        res.status(200).json({
            reviews,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Error fetching pending reviews:", error);
        res.status(500).json({ 
            message: "Failed to fetch pending reviews", 
            error: error.message 
        });
    }
};

// Get all reviews with filtering (admin only)
const getAllReviews = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            status, 
            rating, 
            reviewerType,
            sortBy = 'createdAt', 
            sortOrder = 'desc' 
        } = req.query;

        const filter = {};
        if (status && status !== 'all') filter.status = status;
        if (rating && rating !== 'all') filter.rating = parseInt(rating);
        if (reviewerType && reviewerType !== 'all') filter.reviewerType = reviewerType;

        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const reviews = await Review.find(filter).lean()
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('userId', 'name email')
            .populate('approvedBy', 'name')
            .populate('rejectedBy', 'name');

        const total = await Review.countDocuments(filter);

        res.status(200).json({
            reviews,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ 
            message: "Failed to fetch reviews", 
            error: error.message 
        });
    }
};

// Approve review (admin only)
const approveReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { moderatorNotes } = req.body;

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }

        if (review.status !== 'pending') {
            return res.status(400).json({ 
                message: `Review is already ${review.status}` 
            });
        }

        review.status = 'approved';
        review.approvedBy = req.user._id;
        review.approvedAt = new Date();
        if (moderatorNotes) {
            review.moderatorNotes = moderatorNotes;
        }

        await review.save();
        invalidateReviewCache();

        res.status(200).json({
            message: "Review approved successfully",
            review: {
                id: review._id,
                status: review.status,
                approvedAt: review.approvedAt
            }
        });

    } catch (error) {
        console.error("Error approving review:", error);
        res.status(500).json({ 
            message: "Failed to approve review", 
            error: error.message 
        });
    }
};

// Reject review (admin only)
const rejectReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { rejectionReason, moderatorNotes } = req.body;

        if (!rejectionReason) {
            return res.status(400).json({ 
                message: "Rejection reason is required" 
            });
        }

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }

        if (review.status !== 'pending') {
            return res.status(400).json({ 
                message: `Review is already ${review.status}` 
            });
        }

        review.status = 'rejected';
        review.rejectedBy = req.user._id;
        review.rejectedAt = new Date();
        review.rejectionReason = rejectionReason;
        if (moderatorNotes) {
            review.moderatorNotes = moderatorNotes;
        }

        await review.save();
        invalidateReviewCache();

        res.status(200).json({
            message: "Review rejected successfully",
            review: {
                id: review._id,
                status: review.status,
                rejectedAt: review.rejectedAt,
                rejectionReason: review.rejectionReason
            }
        });

    } catch (error) {
        console.error("Error rejecting review:", error);
        res.status(500).json({ 
            message: "Failed to reject review", 
            error: error.message 
        });
    }
};

// Get user's own review status
const getUserReview = async (req, res) => {
    try {
        const review = await Review.findOne({ userId: req.user._id })
            .select('-userId -userEmail');

        if (!review) {
            return res.status(404).json({ 
                message: "No review found",
                canSubmit: true
            });
        }

        res.status(200).json({
            review,
            canSubmit: false
        });

    } catch (error) {
        console.error("Error fetching user review:", error);
        res.status(500).json({ 
            message: "Failed to fetch review", 
            error: error.message 
        });
    }
};

// Check review eligibility
const checkReviewEligibility = async (req, res) => {
    try {
        const user = req.user;
        const reviewerType = req.reviewerType;

        // Check if user already has a review
        const existingReview = await Review.findOne({ userId: user._id });

        res.status(200).json({
            eligible: true,
            reviewerType,
            hasExistingReview: !!existingReview,
            user: {
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("Error checking review eligibility:", error);
        res.status(500).json({ 
            message: "Failed to check eligibility", 
            error: error.message 
        });
    }
};

// Update review (admin only - for editing before approval)
const updateReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const updates = req.body;

        // Remove fields that shouldn't be updated directly
        delete updates.userId;
        delete updates.userEmail;
        delete updates.status;
        delete updates.approvedBy;
        delete updates.rejectedBy;
        delete updates.approvedAt;
        delete updates.rejectedAt;

        const review = await Review.findByIdAndUpdate(
            reviewId,
            { ...updates, updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }

        invalidateReviewCache();

        res.status(200).json({
            message: "Review updated successfully",
            review
        });

    } catch (error) {
        console.error("Error updating review:", error);
        res.status(500).json({ 
            message: "Failed to update review", 
            error: error.message 
        });
    }
};

module.exports = {
    submitReview,
    getApprovedReviews,
    getPendingReviews,
    getAllReviews,
    approveReview,
    rejectReview,
    getUserReview,
    checkReviewEligibility,
    updateReview
};
