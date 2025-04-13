import json
import os

import requests
import structlog

API_URL = "http://localhost:8000"
logger = structlog.get_logger()


def test_guitar_example():
    """Test the API with the guitar example."""
    logger.info("Starting guitar example test")

    guitar_image_paths = [
        os.path.abspath("guitar_1.jpg"),
        os.path.abspath("guitar_2.jpg"),
    ]
    logger.debug("Resolved image paths", paths=guitar_image_paths)

    # Validate all images exist
    for img_path in guitar_image_paths:
        if not os.path.exists(img_path):
            logger.error("Image not found", path=img_path)
            return

    logger.info("Found all image files", count=len(guitar_image_paths))

    filters = [
        "the guitar is red",
        "the guitar is natural",
        "the guitar is electro-acoustic",
        "the guitar is a Fender",
        "this is a piano",
        "the guitar is in a case",
        "the guitar is a bass",
        "the guitar is a 6-string guitar",
        "the guitar has no pickguard",
        "the guitar has a pickguard",
        "the guitar has a cutaway",
    ]

    payload = {
        "title": "Squier by Fender Acoustic Guitar",
        "description": "Squier by Fender Acoustic Guitar, Natural Finish, Mahogany",
        "image_urls_or_paths": guitar_image_paths,
        "filters": filters,
    }

    logger.info(
        "Prepared request payload",
        title=payload["title"],
        description=payload["description"],
        filter_count=len(filters),
        image_count=len(guitar_image_paths),
    )
    logger.debug("Full payload", payload=payload)

    try:
        logger.info("Sending request to API", endpoint=f"{API_URL}/analyze")
        response = requests.post(f"{API_URL}/analyze", json=payload)
        logger.info(
            "Request completed",
            status_code=response.status_code,
            response_time=response.elapsed.total_seconds(),
        )

        if response.status_code == 200:
            result = response.json()
            logger.info(
                "Analysis successful",
                result_size=len(result),
                filters_analyzed=len(result),
            )
            logger.debug("Analysis results", result=result)
            print(json.dumps(result, indent=2))
        else:
            logger.error(
                "API request failed",
                status_code=response.status_code,
                response=response.text,
            )
    except Exception as e:
        logger.exception("Error sending request", error=str(e))
    finally:
        logger.info("Guitar example test completed")


if __name__ == "__main__":
    logger.info("Script execution started")
    test_guitar_example()
    logger.info("Script execution finished")
